const { UserModel } = require("../models/userModel.js");
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

module.exports = {
  listUsers,
  getUserByUsername,
  updateMyProfile
};
