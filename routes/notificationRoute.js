const express = require("express");
const {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require("../controllers/notificationController.js");
const { requireAuth } = require("../middlewares/authMiddleware.js");
const asyncHandler = require("../utils/asyncHandler.js");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(listNotifications));
router.patch("/:id/read", requireAuth, asyncHandler(markNotificationRead));
router.post("/read-all", requireAuth, asyncHandler(markAllNotificationsRead));

module.exports = router;
