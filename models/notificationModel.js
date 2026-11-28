const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, ref: "User", index: true },
    actorId: { type: String, required: true, ref: "User" },
    type: {
      type: String,
      required: true,
      enum: ["like", "comment", "follow", "share", "message"],
    },
    postId: { type: String, ref: "Post", default: null },
    commentId: { type: String, default: null },
    message: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    createdAt: { type: String, required: true, index: true },
  },
  { versionKey: false },
);

const NotificationModel = mongoose.model("Notification", notificationSchema);

module.exports = NotificationModel;
