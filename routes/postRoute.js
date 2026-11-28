const express = require("express");
const {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  getPostById,
  listPosts,
  sharePost,
  toggleLike,
} = require("../controllers/postController.js");
const {
  optionalAuth,
  requireAuth,
  requireDb,
} = require("../middlewares/authMiddleware.js");
const asyncHandler = require("../utils/asyncHandler.js");

const router = express.Router();

router.get("/posts", requireDb, optionalAuth, asyncHandler(listPosts));
router.get("/posts/:id", requireDb, optionalAuth, asyncHandler(getPostById));
router.post("/posts", requireAuth, asyncHandler(createPost));
router.delete("/posts/:id", requireAuth, asyncHandler(deletePost));
router.post("/posts/:id/like", requireAuth, asyncHandler(toggleLike));
router.post("/posts/:id/comments", requireAuth, asyncHandler(addComment));
router.delete("/comments/:id", requireAuth, asyncHandler(deleteComment));
router.post("/posts/:id/share", requireAuth, asyncHandler(sharePost));

module.exports = router;
