const { CommentModel } = require("../models/commentModel.js");
const { FollowModel } = require("../models/followModel.js");
const { LikeModel } = require("../models/likeModel.js");
const { PostModel } = require("../models/postModel.js");
const { UserModel } = require("../models/userModel.js");

async function buildUserProfile(user, viewerId) {
  const id = user._id;
  const [followersCount, followingCount, postsCount] = await Promise.all([
    FollowModel.countDocuments({ followingId: id }),
    FollowModel.countDocuments({ followerId: id }),
    PostModel.countDocuments({ userId: id }),
  ]);

  let isFollowing = false;
  let followsMe = false;
  if (viewerId && viewerId !== id) {
    const [f1, f2] = await Promise.all([
      FollowModel.exists({ followerId: viewerId, followingId: id }),
      FollowModel.exists({ followerId: id, followingId: viewerId }),
    ]);
    isFollowing = Boolean(f1);
    followsMe = Boolean(f2);
  }

  return {
    id,
    username: user.username || "user",
    displayName: user.displayName || user.username || "User",
    bio: user.bio || "",
    location: user.location || "",
    website: user.website || "",
    avatarUrl: user.avatarUrl || "",
    bannerUrl: user.bannerUrl || "",
    createdAt: user.createdAt,
    followersCount,
    followingCount,
    postsCount,
    isFollowing,
    followsMe,
    isOnline: isUserOnline(id),
  };
}

async function getCommentsForPost(postId) {
  const comments = await CommentModel.find({ postId })
    .sort({ createdAt: 1 })
    .lean();
  const userIds = Array.from(new Set(comments.map((c) => c.userId)));
  const users = await UserModel.find({ _id: { $in: userIds } })
    .select("_id username displayName avatarUrl")
    .lean();
  const userMap = new Map(users.map((u) => [u._id, u]));

  return comments.map((c) => {
    const author = userMap.get(c.userId);
    return {
      id: c._id,
      postId: c.postId,
      userId: c.userId,
      content: c.content,
      createdAt: c.createdAt,
      author: {
        id: c.userId,
        username: author?.username || "unknown",
        displayName: author?.displayName || "Unknown User",
        avatarUrl: author?.avatarUrl || "",
      },
    };
  });
}

async function hydratePost(post, viewerId) {
  const [author, likesCount, commentsCount, sharesCount, likedDoc, sharedDoc] =
    await Promise.all([
      UserModel.findById(post.userId)
        .select("_id username displayName avatarUrl")
        .lean(),
      LikeModel.countDocuments({ postId: post._id }),
      CommentModel.countDocuments({ postId: post._id }),
      PostModel.countDocuments({ originalPostId: post._id }),
      viewerId
        ? LikeModel.exists({ userId: viewerId, postId: post._id })
        : Promise.resolve(null),
      viewerId
        ? PostModel.exists({ userId: viewerId, originalPostId: post._id })
        : Promise.resolve(null),
    ]);

  let originalPost = null;
  if (post.originalPostId) {
    const orig = await PostModel.findById(post.originalPostId).lean();
    if (orig) {
      const origAuthor = await UserModel.findById(orig.userId)
        .select("_id username displayName avatarUrl")
        .lean();
      originalPost = {
        id: orig._id,
        userId: orig.userId,
        content: orig.content || "",
        mediaUrl: orig.mediaUrl || null,
        mediaType: orig.mediaType || null,
        createdAt: orig.createdAt,
        author: {
          id: orig.userId,
          username: origAuthor?.username || "unknown",
          displayName: origAuthor?.displayName || "Unknown User",
          avatarUrl: origAuthor?.avatarUrl || "",
        },
      };
    }
  }

  return {
    id: post._id,
    userId: post.userId,
    content: post.content || "",
    mediaUrl: post.mediaUrl || null,
    mediaType: post.mediaType || null,
    originalPostId: post.originalPostId || null,
    originalPost,
    createdAt: post.createdAt,
    likesCount,
    commentsCount,
    sharesCount,
    isLiked: Boolean(likedDoc),
    isSharedByMe: Boolean(sharedDoc),
    author: {
      id: post.userId,
      username: author?.username || "unknown",
      displayName: author?.displayName || "Unknown User",
      avatarUrl: author?.avatarUrl || "",
      isOnline: isUserOnline(post.userId),
    },
  };
}

module.exports = {
  buildUserProfile,
  getCommentsForPost,
  hydratePost,
};
