const crypto = require("crypto");
const { ConversationModel } = require("../models/conversationModel.js");
const { MessageModel } = require("../models/messageModel.js");
const { UserModel } = require("../models/userModel.js");
const { sanitizeSafeUrl } = require("../utils/crypto.js");
const {
  createNotification,
  isUserOnline,
  pushToUser,
} = require("../utils/realtime.js");

async function listConversations(req, res) {
  const uid = req.user.id;
  const rows = await ConversationModel.find({
    $or: [{ user1Id: uid }, { user2Id: uid }],
  })
    .sort({ updatedAt: -1 })
    .lean();

  const peerIds = rows.map((c) => (c.user1Id === uid ? c.user2Id : c.user1Id));
  const peers = await UserModel.find({ _id: { $in: peerIds } })
    .select("_id username displayName avatarUrl bio")
    .lean();
  const peerMap = new Map(peers.map((p) => [p._id, p]));

  const conversations = (
    await Promise.all(
      rows.map(async (c) => {
        const peerId = c.user1Id === uid ? c.user2Id : c.user1Id;
        const peer = peerMap.get(peerId);
        if (!peer) return null;

        const [lastMsg, unreadCount] = await Promise.all([
          MessageModel.findOne({ conversationId: c._id })
            .sort({ createdAt: -1 })
            .lean(),
          MessageModel.countDocuments({
            conversationId: c._id,
            senderId: { $ne: uid },
            isRead: false,
          }),
        ]);

        return {
          id: c._id,
          updatedAt: c.updatedAt,
          unreadCount,
          peer: {
            id: peer._id,
            username: peer.username,
            displayName: peer.displayName,
            avatarUrl: peer.avatarUrl || "",
            bio: peer.bio || "",
            isOnline: isUserOnline(peer._id),
          },
          lastMessage: lastMsg
            ? {
                id: lastMsg._id,
                senderId: lastMsg.senderId,
                content: lastMsg.content || "",
                mediaUrl: lastMsg.mediaUrl || null,
                mediaType: lastMsg.mediaType || null,
                createdAt: lastMsg.createdAt,
              }
            : null,
        };
      }),
    )
  ).filter(Boolean);

  res.json({ conversations });
}

async function getOrCreateConversation(req, res) {
  const recipientId =
    typeof req.body?.recipientId === "string" ? req.body.recipientId : "";
  if (!recipientId || recipientId === req.user.id) {
    res.status(400).json({ error: "Valid recipient is required." });
    return;
  }

  const peer = await UserModel.findById(recipientId)
    .select("_id username displayName avatarUrl bio")
    .lean();
  if (!peer) {
    res.status(404).json({ error: "Recipient not found." });
    return;
  }

  const [u1, u2] = [req.user.id, recipientId].sort();
  let conv = await ConversationModel.findOne({
    user1Id: u1,
    user2Id: u2,
  }).lean();

  if (!conv) {
    const created = await ConversationModel.create({
      _id: `conv_${crypto.randomUUID()}`,
      user1Id: u1,
      user2Id: u2,
      updatedAt: new Date().toISOString(),
    });
    conv = created.toObject();
  }

  res.json({
    conversation: {
      id: conv._id,
      updatedAt: conv.updatedAt,
      unreadCount: 0,
      peer: {
        id: peer._id,
        username: peer.username,
        displayName: peer.displayName,
        avatarUrl: peer.avatarUrl || "",
        bio: peer.bio || "",
        isOnline: isUserOnline(peer._id),
      },
      lastMessage: null,
    },
  });
}

async function listMessages(req, res) {
  const convId = typeof req.params.id === "string" ? req.params.id : "";
  const conv = await ConversationModel.findById(convId).lean();

  if (!conv || (conv.user1Id !== req.user.id && conv.user2Id !== req.user.id)) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }

  await MessageModel.updateMany(
    { conversationId: conv._id, senderId: { $ne: req.user.id }, isRead: false },
    { $set: { isRead: true } },
  );

  const rows = await MessageModel.find({ conversationId: conv._id })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  const messages = rows.map((m) => ({
    id: m._id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.content || "",
    mediaUrl: m.mediaUrl || null,
    mediaType: m.mediaType || null,
    isRead: Boolean(m.isRead),
    createdAt: m.createdAt,
  }));

  res.json({ messages });
}

async function sendMessage(req, res) {
  const convId = typeof req.params.id === "string" ? req.params.id : "";
  const conv = await ConversationModel.findById(convId).lean();

  if (!conv || (conv.user1Id !== req.user.id && conv.user2Id !== req.user.id)) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }

  const content =
    typeof req.body?.content === "string"
      ? req.body.content.trim().slice(0, 1500)
      : "";
  const safeMediaUrl = req.body?.mediaUrl
    ? sanitizeSafeUrl(req.body.mediaUrl)
    : "";
  const safeMediaType =
    safeMediaUrl &&
    (req.body?.mediaType === "image" || req.body?.mediaType === "video")
      ? req.body.mediaType
      : null;

  if (!content && !safeMediaUrl) {
    res.status(400).json({ error: "Message cannot be empty." });
    return;
  }

  const id = `msg_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  await MessageModel.create({
    _id: id,
    conversationId: conv._id,
    senderId: req.user.id,
    content,
    mediaUrl: safeMediaUrl || null,
    mediaType: safeMediaType,
    isRead: false,
    createdAt,
  });

  await ConversationModel.updateOne(
    { _id: conv._id },
    { $set: { updatedAt: createdAt } },
  );

  const message = {
    id,
    conversationId: conv._id,
    senderId: req.user.id,
    content,
    mediaUrl: safeMediaUrl || null,
    mediaType: safeMediaType,
    isRead: false,
    createdAt,
  };

  const recipientId =
    conv.user1Id === req.user.id ? conv.user2Id : conv.user1Id;

  pushToUser(recipientId, {
    type: "message:created",
    conversationId: conv._id,
    message,
    sender: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl,
    },
  });

  await createNotification({
    recipientId,
    actorId: req.user.id,
    type: "message",
    message: content ? content.slice(0, 80) : "Sent an attachment",
  });

  res.status(201).json({ message });
}

module.exports = {
  listConversations,
  getOrCreateConversation,
  listMessages,
  sendMessage,
};
