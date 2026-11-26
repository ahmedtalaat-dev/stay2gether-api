const multer = require("multer");

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Unsupported file type. Allowed: JPG, PNG, WebP, GIF, MP4, WebM.",
        ),
      );
    }
  },
});

function handleSingleMediaUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      res
        .status(400)
        .json({ error: err instanceof Error ? err.message : "Upload failed." });
      return;
    }
    next();
  });
}

module.exports = handleSingleMediaUpload;
