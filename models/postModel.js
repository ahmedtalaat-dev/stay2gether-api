const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, ref: "User", index: true },
    content: { type: String, default: "" },
    mediaUrl: { type: String, default: null },
    mediaType: { type: String, enum: ["image", "video", null], default: null },
    originalPostId: { type: String, ref: "Post", default: null, index: true },
    createdAt: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

const PostModel = mongoose.model("Post", postSchema);

module.exports = PostModel;
