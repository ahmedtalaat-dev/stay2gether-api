const express = require("express");
const {
  getOrCreateConversation,
  listConversations,
  listMessages,
  sendMessage,
} = require("../controllers/messageController.js");
const { requireAuth } = require("../middlewares/authMiddleware.js");
const asyncHandler = require("../utils/asyncHandler.js");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(listConversations));
router.post("/", requireAuth, asyncHandler(getOrCreateConversation));
router.get("/:id/messages", requireAuth, asyncHandler(listMessages));
router.post("/:id/messages", requireAuth, asyncHandler(sendMessage));

module.exports = router;
