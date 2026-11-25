const { getUserFromToken } = require("../utils/crypto.js");
const { isDbConnected } = require("../config/db.js");

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return null;
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function requireDb(_req, res, next) {
  if (!isDbConnected()) {
    res.status(503).json({
      error:
        "MongoDB is not connected. Configure MONGODB_URI in your server environment.",
    });
    return;
  }
  next();
}

async function optionalAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (token && isDbConnected()) {
      const user = await getUserFromToken(token);
      if (user) {
        req.user = user;
        req.token = token;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAuth(req, res, next) {
  try {
    if (!isDbConnected()) {
      res.status(503).json({
        error:
          "MongoDB is not connected. Configure MONGODB_URI in your server environment.",
      });
      return;
    }
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await getUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireDb,
  optionalAuth,
  requireAuth,
};
