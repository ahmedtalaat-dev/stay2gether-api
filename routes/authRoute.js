const express = require("express");
const {
  login,
  logout,
  me,
  signup,
} = require("../controllers/authController.js");
const { requireAuth, requireDb } = require("../middlewares/authMiddleware.js");
const asyncHandler = require("../utils/asyncHandler.js");

const router = express.Router();

router.post("/signup", requireDb, asyncHandler(signup));
router.post("/login", requireDb, asyncHandler(login));
router.post("/logout", requireAuth, asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));

module.exports = router;
