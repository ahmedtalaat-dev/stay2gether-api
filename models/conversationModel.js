const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    user1Id: { type: String, required: true, ref: "User", index: true },
    user2Id: { type: String, required: true, ref: "User", index: true },
    updatedAt: { type: String, required: true, index: true },
  },
  { versionKey: false },
);

conversationSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

const ConversationModel = mongoose.model("Conversation", conversationSchema);

module.exports = ConversationModel;
