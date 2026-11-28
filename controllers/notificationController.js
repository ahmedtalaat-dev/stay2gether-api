const { NotificationModel } = require("../models/notificationModel.js");
const { PostModel } = require("../models/postModel.js");
const { UserModel } = require("../models/userModel.js");

async function listNotifications(req, res) {
  const rows = await NotificationModel.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(60)
    .lean();

  const actorIds = Array.from(new Set(rows.map((r) => r.actorId)));
  const postIds = Array.from(
    new Set(rows.map((r) => r.postId).filter((id) => Boolean(id))),
  );

  const [actors, posts] = await Promise.all([
    UserModel.find({ _id: { $in: actorIds } })
      .select("_id username displayName avatarUrl")
      .lean(),
    PostModel.find({ _id: { $in: postIds } })
      .select("_id content")
      .lean(),
  ]);

  const actorMap = new Map(actors.map((a) => [a._id, a]));
  const postMap = new Map(posts.map((p) => [p._id, p]));

  const notifications = rows.map((r) => {
    const actor = actorMap.get(r.actorId);
    const post = r.postId ? postMap.get(r.postId) : null;
    return {
      id: r._id,
      userId: r.userId,
      actorId: r.actorId,
      type: r.type,
      postId: r.postId || null,
      commentId: r.commentId || null,
      message: r.message || null,
      isRead: Boolean(r.isRead),
      createdAt: r.createdAt,
      actor: {
        id: r.actorId,
        username: actor?.username || "unknown",
        displayName: actor?.displayName || "Unknown User",
        avatarUrl: actor?.avatarUrl || "",
      },
      postSnippet: post?.content ? post.content.slice(0, 80) : null,
    };
  });

  res.json({ notifications });
}

async function markNotificationRead(req, res) {
  const notifId = typeof req.params.id === "string" ? req.params.id : "";
  await NotificationModel.updateOne(
    { _id: notifId, userId: req.user.id },
    { $set: { isRead: true } },
  );
  res.json({ ok: true });
}

async function markAllNotificationsRead(req, res) {
  await NotificationModel.updateMany(
    { userId: req.user.id },
    { $set: { isRead: true } },
  );
  res.json({ ok: true });
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
