const crypto = require("crypto");
const { SessionModel } = require("../models/sessionModel.js");
const { UserModel } = require("../models/userModel.js");

function hashPassword(password, existingSalt) {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await SessionModel.create({
    _id: token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  return token;
}

async function getUserFromToken(token) {
  if (!token || typeof token !== "string") return null;

  const session = await SessionModel.findById(token).lean();
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await SessionModel.deleteOne({ _id: token });
    return null;
  }

  const user = await UserModel.findById(session.userId)
    .select("_id username displayName email avatarUrl")
    .lean();
  if (!user) return null;

  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl || "",
  };
}

function sanitizeSafeUrl(raw) {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/src/assets/")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }
  return "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getUserFromToken,
  sanitizeSafeUrl,
  escapeRegex,
};
