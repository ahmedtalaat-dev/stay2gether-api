const {
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
} = require("../utils/cloudinary.js");

async function uploadMedia(req, res) {
  if (!req.file) {
    res.status(400).json({ error: "No media file provided." });
    return;
  }

  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      error:
        "Cloudinary credentials are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server secrets.",
    });
    return;
  }

  try {
    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      req.file.mimetype,
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Cloudinary upload failed.",
    });
  }
}

module.exports = uploadMedia;
