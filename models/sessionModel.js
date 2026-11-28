const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, ref: "User", index: true },
    createdAt: { type: String, required: true },
    expiresAt: { type: String, required: true },
  },
  { versionKey: false },
);

const SessionModel = mongoose.model("Session", sessionSchema);

module.exports = SessionModel;
