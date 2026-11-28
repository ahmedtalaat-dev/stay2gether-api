const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    followerId: { type: String, required: true, ref: "User", index: true },
    followingId: { type: String, required: true, ref: "User", index: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

const FollowModel = mongoose.model("Follow", followSchema);

module.exports = FollowModel;
