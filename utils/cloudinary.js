const { cloudinary } = require("cloudinary");

export function isCloudinaryConfigured() {
  return (
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

function ensureConfigured() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    secure: true,
  });
}

export async function uploadBufferToCloudinary(buffer, mimetype) {
  url: string;
  mediaType: "image" | "video";
}
{
  ensureConfigured();
  const isVideo = mimetype.startsWith("video/");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "threadline",
        resource_type: isVideo ? "video" : "image",
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error("Cloudinary upload failed."));
          return;
        }
        resolve({
          url: result.secure_url,
          mediaType: result.resource_type === "video" ? "video" : "image",
        });
      },
    );
    stream.end(buffer);
  });
}
