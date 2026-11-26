const crypto = require("crypto");
const { CommentModel } = require("../models/commentModel.js");
const { FollowModel } = require("../models/followModel.js");
const { LikeModel } = require("../models/likeModel.js");
const { PostModel } = require("../models/postModel.js");
const { UserModel } = require("../models/userModel.js");
const { escapeRegex, sanitizeSafeUrl } = require("../utils/crypto.ts");
const { getCommentsForPost, hydratePost } = require("../utils/serializers.ts");

async function listPosts(req, res) {
  const tab = req.query.tab === "following" ? "following" : "foryou";
  const authorId =
    typeof req.query.authorId === "string" ? req.query.authorId.trim() : "";
  const mediaOnly = req.query.mediaOnly === "1";
  const sharesOnly = req.query.sharesOnly === "1";
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const query = {};

  if (tab === "following" && req.user) {
    const follows = await FollowModel.find({ followerId: req.user.id })
      .select("followingId")
      .lean();
    const ids = [req.user.id, ...follows.map((f) => f.followingId)];
    query.userId = { $in: ids };
  }

  if (authorId) {
    query.userId = authorId;
  }

  if (mediaOnly) {
    query.mediaUrl = { $ne: null };
  }

  if (sharesOnly) {
    query.originalPostId = { $ne: null };
  }

  if (rawQ) {
    const regex = { $regex: escapeRegex(rawQ), $options: "i" };
    const matchedUsers = await UserModel.find({
      $or: [{ username: regex }, { displayName: regex }],
    })
      .select("_id")
      .lean();
    const matchedUserIds = matchedUsers.map((u) => u._id);
    query.$or = [{ content: regex }, { userId: { $in: matchedUserIds } }];
  }

  const rows = await PostModel.find(query)
    .sort({ createdAt: -1 })
    .limit(60)
    .lean();
  const posts = await Promise.all(
    rows.map(async (row) => ({
      ...(await hydratePost(row, req.user?.id)),
      comments: await getCommentsForPost(row._id),
    })),
  );

  res.json({ posts });
}

async function getPostById(req, res) {
  const postId = typeof req.params.id === "string" ? req.params.id : "";
  const row = await PostModel.findById(postId).lean();
  if (!row) {
    res.status(404).json({ error: "Post not found." });
    return;
  }

  res.json({
    post: {
      ...(await hydratePost(row, req.user?.id)),
      comments: await getCommentsForPost(row._id),
    },
  });
}

async function createPost(req, res) {
  const { content, mediaUrl, mediaType } = req.body ?? {};
  const cleanContent =
    typeof content === "string" ? content.trim().slice(0, 600) : "";
  const safeMediaUrl = mediaUrl ? sanitizeSafeUrl(mediaUrl) : "";
  const safeMediaType =
    safeMediaUrl && (mediaType === "image" || mediaType === "video")
      ? mediaType
      : null;

  if (!cleanContent && !safeMediaUrl) {
    res
      .status(400)
      .json({ error: "Post must contain text or a media attachment." });
    return;
  }

  const id = `post_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  const doc = await PostModel.create({
    _id: id,
    userId: req.user.id,
    content: cleanContent,
    mediaUrl: safeMediaUrl || null,
    mediaType: safeMediaType,
    originalPostId: null,
    createdAt,
  });

  const post = {
    ...(await hydratePost(doc.toObject(), req.user.id)),
    comments: [],
  };
  broadcastAll({ type: "post:created", post });
  res.status(201).json({ post });
}

async function deletePost(req, res) {
  const postId = typeof req.params.id === "string" ? req.params.id : "";
  const existing = await PostModel.findById(postId).lean();
  if (!existing) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  if (existing.userId !== req.user.id) {
    res.status(403).json({ error: "You can only delete your own posts." });
    return;
  }

  await Promise.all([
    PostModel.deleteOne({ _id: existing._id }),
    LikeModel.deleteMany({ postId: existing._id }),
    CommentModel.deleteMany({ postId: existing._id }),
  ]);

  broadcastAll({ type: "post:deleted", postId: existing._id });
  res.json({ ok: true });
}

async function toggleLike(req, res) {
  const postId = typeof req.params.id === "string" ? req.params.id : "";
  const post = await PostModel.findById(postId).lean();
  if (!post) {
    res.status(404).json({ error: "Post not found." });
    return;
  }

  const existing = await LikeModel.findOne({
    userId: req.user.id,
    postId: post._id,
  });
  let isLiked;
  if (existing) {
    await LikeModel.deleteOne({ userId: req.user.id, postId: post._id });
    isLiked = false;
  } else {
    await LikeModel.create({
      userId: req.user.id,
      postId: post._id,
      createdAt: new Date().toISOString(),
    });
    isLiked = true;
    await createNotification({
      recipientId: post.userId,
      actorId: req.user.id,
      type: "like",
      postId: post._id,
    });
  }

  const likesCount = await LikeModel.countDocuments({ postId: post._id });
  broadcastAll({ type: "post:liked", postId: post._id, likesCount });
  res.json({ isLiked, likesCount });
}

async function addComment(req, res) {
  const postId = typeof req.params.id === "string" ? req.params.id : "";
  const post = await PostModel.findById(postId).lean();
  if (!post) {
    res.status(404).json({ error: "Post not found." });
    return;
  }

  const content =
    typeof req.body?.content === "string"
      ? req.body.content.trim().slice(0, 400)
      : "";
  if (!content) {
    res.status(400).json({ error: "Comment text cannot be empty." });
    return;
  }

  const id = `cmt_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  await CommentModel.create({
    _id: id,
    postId: post._id,
    userId: req.user.id,
    content,
    createdAt,
  });

  await createNotification({
    recipientId: post.userId,
    actorId: req.user.id,
    type: "comment",
    postId: post._id,
    commentId: id,
    message: content.slice(0, 100),
  });

  const comment = {
    id,
    postId: post._id,
    userId: req.user.id,
    content,
    createdAt,
    author: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl,
    },
  };

  broadcastAll({ type: "comment:created", postId: post._id, comment });
  res.status(201).json({ comment });
}

async function deleteComment(req, res) {
  const commentId = typeof req.params.id === "string" ? req.params.id : "";
  const comment = await CommentModel.findById(commentId).lean();
  if (!comment) {
    res.status(404).json({ error: "Comment not found." });
    return;
  }

  const post = await PostModel.findById(comment.postId).select("userId").lean();
  if (comment.userId !== req.user.id && post?.userId !== req.user.id) {
    res.status(403).json({ error: "Unauthorized to delete this comment." });
    return;
  }

  await CommentModel.deleteOne({ _id: comment._id });
  broadcastAll({
    type: "comment:deleted",
    postId: comment.postId,
    commentId: comment._id,
  });
  res.json({ ok: true });
}

async function sharePost(req, res) {
  const postId = typeof req.params.id === "string" ? req.params.id : "";
  const target = await PostModel.findById(postId).lean();
  if (!target) {
    res.status(404).json({ error: "Post not found." });
    return;
  }

  const rootPostId = target.originalPostId || target._id;
  const rootPost = await PostModel.findById(rootPostId).lean();
  if (!rootPost) {
    res.status(404).json({ error: "Original post not found." });
    return;
  }

  const note =
    typeof req.body?.content === "string"
      ? req.body.content.trim().slice(0, 400)
      : "";
  const id = `post_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  const created = await PostModel.create({
    _id: id,
    userId: req.user.id,
    content: note,
    mediaUrl: null,
    mediaType: null,
    originalPostId: rootPost._id,
    createdAt,
  });

  await createNotification({
    recipientId: rootPost.userId,
    actorId: req.user.id,
    type: "share",
    postId: rootPost._id,
    message: note || null,
  });

  const post = {
    ...(await hydratePost(created.toObject(), req.user.id)),
    comments: [],
  };
  const sharesCount = await PostModel.countDocuments({
    originalPostId: rootPost._id,
  });

  broadcastAll({ type: "post:created", post });
  broadcastAll({ type: "post:shared", postId: rootPost._id, sharesCount });
  res.status(201).json({ post, sharesCount });
}

module.exports = {
  listPosts,
  getPostById,
  createPost,
  deletePost,
  toggleLike,
  addComment,
  deleteComment,
  sharePost,
};
