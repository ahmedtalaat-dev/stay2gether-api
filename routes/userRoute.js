const express = require("express");
const {
  getFollowers,
  getFollowing,
  getUserByUsername,
  listUsers,
  toggleFollow,
  updateMyProfile,
} = require("../controllers/userController.js");
const {
  optionalAuth,
  requireAuth,
  requireDb,
} = require("../middlewares/authMiddleware.js");
const asyncHandler = require("../utils/asyncHandler.js");

const router = express.Router();

router.get("/", requireDb, optionalAuth, asyncHandler(listUsers));
router.patch("/me", requireAuth, asyncHandler(updateMyProfile));
router.get(
  "/:username",
  requireDb,
  optionalAuth,
  asyncHandler(getUserByUsername),
);
router.post("/:id/follow", requireAuth, asyncHandler(toggleFollow));
router.get(
  "/:id/followers",
  requireDb,
  optionalAuth,
  asyncHandler(getFollowers),
);
router.get(
  "/:id/following",
  requireDb,
  optionalAuth,
  asyncHandler(getFollowing),
);

module.exports = router;
