const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    postId: { type: String, required: true, ref: "Post", index: true },
    userId: { type: String, required: true, ref: "User" },
    content: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  { timestamps: true },
);

const CommentModel = mongoose.model("Comment", commentSchema);

module.exports = CommentModel;
