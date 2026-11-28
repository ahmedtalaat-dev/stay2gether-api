const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    conversationId: {
      type: String,
      required: true,
      ref: "Conversation",
      index: true,
    },
    senderId: { type: String, required: true, ref: "User" },
    content: { type: String, default: "" },
    mediaUrl: { type: String, default: null },
    mediaType: { type: String, enum: ["image", "video", null], default: null },
    isRead: { type: Boolean, default: false },
    createdAt: { type: String, required: true, index: true },
  },
  { versionKey: false },
);

const MessageModel = mongoose.model("Message", messageSchema);

module.exports = MessageModel;
