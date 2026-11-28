const crypto = require("crypto");
const { ConversationModel } = require("../models/conversationModel.js");
const { MessageModel } = require("../models/messageModel.js");
const { NotificationModel } = require("../models/notificationModel.js");
const { SessionModel } = require("../models/sessionModel.js");
const { UserModel } = require("../models/userModel.js");
const {
  createSession,
  hashPassword,
  sanitizeSafeUrl,
  verifyPassword,
} = require("../utils/crypto.js");
const { buildUserProfile } = require("../utils/serializers.js");

async function signup(req, res) {
  const { username, displayName, email, password, bio, avatarUrl } =
    req.body ?? {};
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof displayName !== "string"
  ) {
    res
      .status(400)
      .json({ error: "Display name, username, and password are required." });
    return;
  }

  const cleanUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const cleanDisplayName = displayName.trim();
  const cleanEmail =
    typeof email === "string" && email.trim()
      ? email.trim().toLowerCase()
      : `${cleanUsername}@threadline.local`;

  if (cleanUsername.length < 3 || cleanUsername.length > 24) {
    res
      .status(400)
      .json({
        error:
          "Username must be 3–24 characters (letters, numbers, underscores).",
      });
    return;
  }
  if (cleanDisplayName.length < 1 || cleanDisplayName.length > 50) {
    res.status(400).json({ error: "Display name must be 1–50 characters." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  const existing = await UserModel.findOne({
    $or: [{ username: cleanUsername }, { email: cleanEmail }],
  }).lean();

  if (existing) {
    res.status(409).json({ error: "Username or email is already taken." });
    return;
  }

  const id = `usr_${crypto.randomUUID()}`;
  const { hash, salt } = hashPassword(password);
  const createdAt = new Date().toISOString();
  const safeAvatar = sanitizeSafeUrl(avatarUrl);
  const safeBio = typeof bio === "string" ? bio.trim().slice(0, 280) : "";

  let userDoc;
  try {
    userDoc = await UserModel.create({
      _id: id,
      username: cleanUsername,
      displayName: cleanDisplayName,
      email: cleanEmail,
      passwordHash: hash,
      passwordSalt: salt,
      bio: safeBio,
      location: "",
      website: "",
      avatarUrl: safeAvatar,
      bannerUrl: "",
      createdAt,
    });
  } catch (err) {
    const code = err?.code;
    if (code === 11000) {
      res.status(409).json({ error: "Username or email is already taken." });
      return;
    }
    throw err;
  }

  const token = await createSession(id);
  const profile = await buildUserProfile(userDoc.toObject(), id);
  res.status(201).json({ token, user: profile });
}

async function login(req, res) {
  const { identifier, password } = req.body ?? {};
  if (typeof identifier !== "string" || typeof password !== "string") {
    res
      .status(400)
      .json({ error: "Username/email and password are required." });
    return;
  }

  const clean = identifier.trim().toLowerCase();
  const user = await UserModel.findOne({
    $or: [{ username: clean }, { email: clean }],
  }).lean();

  if (
    !user ||
    !verifyPassword(password, user.passwordHash, user.passwordSalt)
  ) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const token = await createSession(user._id);
  const profile = await buildUserProfile(user, user._id);
  res.json({ token, user: profile });
}

async function logout(req, res) {
  if (req.token) {
    await SessionModel.deleteOne({ _id: req.token });
  }
  res.json({ ok: true });
}

async function me(req, res) {
  const user = await UserModel.findById(req.user.id).lean();
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const userConvIds = await ConversationModel.find({
    $or: [{ user1Id: req.user.id }, { user2Id: req.user.id }],
  })
    .select("_id")
    .lean();

  const [profile, unreadNotifications, unreadMessages] = await Promise.all([
    buildUserProfile(user, req.user.id),
    NotificationModel.countDocuments({ userId: req.user.id, isRead: false }),
    MessageModel.countDocuments({
      conversationId: { $in: userConvIds.map((c) => c._id) },
      senderId: { $ne: req.user.id },
      isRead: false,
    }),
  ]);

  res.json({ user: profile, unreadNotifications, unreadMessages });
}

module.exports = {
  signup,
  login,
  logout,
  me,
};
