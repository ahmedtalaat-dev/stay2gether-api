const { FollowModel } = require("../models/followModel.js");
const { UserModel } = require("../models/userModel.js");
const { escapeRegex, sanitizeSafeUrl } = require("../utils/crypto.js");
const { createNotification } = require("../utils/realtime.js");
const { buildUserProfile } = require("../utils/serializers.js");

async function listUsers(req, res) {
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const filter = rawQ
    ? {
        $or: [
          { username: { $regex: escapeRegex(rawQ), $options: "i" } },
          { displayName: { $regex: escapeRegex(rawQ), $options: "i" } },
          { bio: { $regex: escapeRegex(rawQ), $options: "i" } },
        ],
      }
    : {};

  const rows = await UserModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  const users = await Promise.all(
    rows.map((u) => buildUserProfile(u, req.user?.id)),
  );
  res.json({ users });
}

async function getUserByUsername(req, res) {
  const rawUsername =
    typeof req.params.username === "string" ? req.params.username : "";
  const username = rawUsername.trim().toLowerCase();
  const row = await UserModel.findOne({ username }).lean();
  if (!row) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const user = await buildUserProfile(row, req.user?.id);
  res.json({ user });
}

async function updateMyProfile(req, res) {
  const { displayName, bio, location, website, avatarUrl, bannerUrl } =
    req.body ?? {};
  const existing = await UserModel.findById(req.user.id).lean();
  if (!existing) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const nextDisplayName =
    typeof displayName === "string" && displayName.trim()
      ? displayName.trim().slice(0, 50)
      : existing.displayName;
  const nextBio =
    typeof bio === "string" ? bio.trim().slice(0, 280) : existing.bio;
  const nextLocation =
    typeof location === "string"
      ? location.trim().slice(0, 60)
      : existing.location;
  const nextWebsite =
    typeof website === "string"
      ? sanitizeSafeUrl(website).slice(0, 120)
      : existing.website;
  const nextAvatar =
    typeof avatarUrl === "string"
      ? avatarUrl === ""
        ? ""
        : sanitizeSafeUrl(avatarUrl) || existing.avatarUrl
      : existing.avatarUrl;
  const nextBanner =
    typeof bannerUrl === "string"
      ? bannerUrl === ""
        ? ""
        : sanitizeSafeUrl(bannerUrl) || existing.bannerUrl
      : existing.bannerUrl;

  const updated = await UserModel.findByIdAndUpdate(
    req.user.id,
    {
      displayName: nextDisplayName,
      bio: nextBio,
      location: nextLocation,
      website: nextWebsite,
      avatarUrl: nextAvatar,
      bannerUrl: nextBanner,
    },
    { new: true },
  ).lean();

  const user = await buildUserProfile(updated, req.user.id);
  res.json({ user });
}

async function toggleFollow(req, res) {
  const targetId = typeof req.params.id === "string" ? req.params.id : "";
  if (!targetId || targetId === req.user.id) {
    res.status(400).json({ error: "You cannot follow yourself." });
    return;
  }

  const targetExists = await UserModel.exists({ _id: targetId });
  if (!targetExists) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const existing = await FollowModel.findOne({
    followerId: req.user.id,
    followingId: targetId,
  });

  let isFollowing;
  if (existing) {
    await FollowModel.deleteOne({
      followerId: req.user.id,
      followingId: targetId,
    });
    isFollowing = false;
  } else {
    await FollowModel.create({
      followerId: req.user.id,
      followingId: targetId,
      createdAt: new Date().toISOString(),
    });
    isFollowing = true;
    await createNotification({
      recipientId: targetId,
      actorId: req.user.id,
      type: "follow",
    });
  }

  const followersCount = await FollowModel.countDocuments({
    followingId: targetId,
  });
  res.json({ isFollowing, followersCount });
}

async function getFollowers(req, res) {
  const userId = typeof req.params.id === "string" ? req.params.id : "";
  const follows = await FollowModel.find({ followingId: userId })
    .sort({ createdAt: -1 })
    .lean();
  const followerIds = follows.map((f) => f.followerId);
  const rows = await UserModel.find({ _id: { $in: followerIds } }).lean();
  const userMap = new Map(rows.map((u) => [u._id, u]));

  const users = await Promise.all(
    followerIds
      .map((id) => userMap.get(id))
      .filter((u) => Boolean(u))
      .map((u) => buildUserProfile(u, req.user?.id)),
  );

  res.json({ users });
}

async function getFollowing(req, res) {
  const userId = typeof req.params.id === "string" ? req.params.id : "";
  const follows = await FollowModel.find({ followerId: userId })
    .sort({ createdAt: -1 })
    .lean();
  const followingIds = follows.map((f) => f.followingId);
  const rows = await UserModel.find({ _id: { $in: followingIds } }).lean();
  const userMap = new Map(rows.map((u) => [u._id, u]));

  const users = await Promise.all(
    followingIds
      .map((id) => userMap.get(id))
      .filter((u) => Boolean(u))
      .map((u) => buildUserProfile(u, req.user?.id)),
  );

  res.json({ users });
}

module.exports = {
  listUsers,
  getUserByUsername,
  updateMyProfile,
  toggleFollow,
  getFollowers,
  getFollowing,
};
