const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, ref: "User", index: true },
    postId: { type: String, required: true, ref: "Post", index: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

likeSchema.index({ userId: 1, postId: 1 }, { unique: true });

const LikeModel = mongoose.model("Like", likeSchema);

module.exports = LikeModel;
