const express = require("express");
const { uploadMedia } = require("../controllers/mediaController.js");
const { requireAuth } = require("../middlewares/authMiddleware.js");
const {
  handleSingleMediaUpload,
} = require("../middlewares/uploadMiddleware.js");
const asyncHandler = require("../utils/asyncHandler.js");

const router = express.Router();

router.post(
  "/upload",
  requireAuth,
  handleSingleMediaUpload,
  asyncHandler(uploadMedia),
);

module.exports = router;
