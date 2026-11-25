const crypto = require("crypto");
const UserModel = require("../models/userModel.js");

const {
  createSession,
  hashPassword,
  verifyPassword,
} = require("../utils/crypto.js");

const { SessionModel } = require("../models/sessionModel.js");

// SIGNUP
async function signup(req, res) {
  try {
    const { username, displayName, email, password } = req.body ?? {};

    if (!username || !displayName || !password) {
      return res.status(400).json({
        error: "Username, display name, and password are required.",
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();
    const cleanEmail = email
      ? email.trim().toLowerCase()
      : `${cleanUsername}@threadline.local`;

    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      return res.status(400).json({
        error: "Username must be 3–24 characters.",
      });
    }

    if (cleanDisplayName.length < 1 || cleanDisplayName.length > 50) {
      return res.status(400).json({
        error: "Display name must be 1–50 characters.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters.",
      });
    }

    const existingUser = await UserModel.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Username or email already exists.",
      });
    }

    const { hash, salt } = hashPassword(password);

    const user = await UserModel.create({
      _id: `usr_${crypto.randomUUID()}`,
      username: cleanUsername,
      displayName: cleanDisplayName,
      email: cleanEmail,
      passwordHash: hash,
      passwordSalt: salt,
    });

    const token = await createSession(user._id);

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      error: "Something went wrong during signup.",
    });
  }
}

// LOGIN
async function login(req, res) {
  try {
    const { identifier, password } = req.body ?? {};

    if (!identifier || !password) {
      return res.status(400).json({
        error: "Username/email and password are required.",
      });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    const user = await UserModel.findOne({
      $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }],
    });

    if (
      !user ||
      !verifyPassword(password, user.passwordHash, user.passwordSalt)
    ) {
      return res.status(401).json({
        error: "Invalid credentials.",
      });
    }

    const token = await createSession(user._id);

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Something went wrong during login.",
    });
  }
}

// LOGOUT
async function logout(req, res) {
  try {
    if (req.token) {
      await SessionModel.deleteOne({
        _id: req.token,
      });
    }

    return res.status(200).json({
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      error: "Something went wrong during logout.",
    });
  }
}

// GET CURRENT USER
async function me(req, res) {
  try {
    const user = await UserModel.findById(req.user.id).select(
      "-passwordHash -passwordSalt",
    );

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Me error:", error);

    return res.status(500).json({
      error: "Could not retrieve user.",
    });
  }
}

module.exports = {
  signup,
  login,
  logout,
  me,
};
