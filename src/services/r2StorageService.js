const { randomUUID } = require("crypto");
const path = require("path");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const {
  getR2Client,
  getR2PublicUrl,
  getR2BucketName,
  loadR2Config,
  REQUIRED_BUCKET,
} = require("../config/r2");

const ALLOWED_IMAGE_MIME_TO_EXT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
};

const ALLOWED_VIDEO_MIME_TO_EXT = {
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
};

/** Backward-compatible alias used by existing image middleware. */
const ALLOWED_MIME_TO_EXT = ALLOWED_IMAGE_MIME_TO_EXT;

function sanitizeExtension(originalName, mimeType, allowedMap) {
  const allowed = allowedMap[mimeType];
  if (!allowed) {
    const error = new Error("Unsupported file type.");
    error.statusCode = 400;
    throw error;
  }

  const ext = path.extname(originalName || "").toLowerCase();
  if (ext && allowed.includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }

  return allowed[0] === ".jpeg" ? ".jpg" : allowed[0];
}

function buildImageObjectKey(originalName, mimeType) {
  const ext = sanitizeExtension(originalName, mimeType, ALLOWED_IMAGE_MIME_TO_EXT);
  return `uploads/${randomUUID()}${ext}`;
}

function buildVideoObjectKey(originalName, mimeType) {
  const ext = sanitizeExtension(originalName, mimeType, ALLOWED_VIDEO_MIME_TO_EXT);
  return `videos/${randomUUID()}${ext}`;
}

function assertSafeObjectKey(objectKey, { kind = "any" } = {}) {
  if (!objectKey || typeof objectKey !== "string") {
    const error = new Error("Object key is required.");
    error.statusCode = 400;
    throw error;
  }

  const key = objectKey.trim();

  if (!key) {
    const error = new Error("Object key is required.");
    error.statusCode = 400;
    throw error;
  }

  if (
    key.includes("://") ||
    key.startsWith("/") ||
    key.includes("..") ||
    key.includes("\\") ||
    /\s/.test(key)
  ) {
    const error = new Error("Invalid object key.");
    error.statusCode = 400;
    throw error;
  }

  const isUpload = key.startsWith("uploads/");
  const isVideo = key.startsWith("videos/");

  if (kind === "image" && !isUpload) {
    const error = new Error("Object key is outside the allowed AURA image upload path.");
    error.statusCode = 400;
    throw error;
  }

  if (kind === "video" && !isVideo) {
    const error = new Error("Object key is outside the allowed AURA video upload path.");
    error.statusCode = 400;
    throw error;
  }

  if (kind === "any" && !isUpload && !isVideo) {
    const error = new Error("Object key is outside the allowed AURA upload path.");
    error.statusCode = 400;
    throw error;
  }

  return key;
}

async function putObject({ buffer, key, mimeType }) {
  loadR2Config();
  const bucket = getR2BucketName();

  if (bucket !== REQUIRED_BUCKET) {
    const error = new Error("Invalid AURA R2 bucket configuration.");
    error.statusCode = 500;
    throw error;
  }

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error("File buffer is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = getR2Client();

  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      },
    });

    await upload.done();

    return {
      key,
      url: getR2PublicUrl(key),
      bucket,
      contentType: mimeType,
      size: buffer.length,
    };
  } catch (err) {
    const error = new Error("Failed to upload file to storage.");
    error.statusCode = 502;
    error.cause = err;
    throw error;
  }
}

async function uploadImage({ buffer, originalName, mimeType }) {
  if (!ALLOWED_IMAGE_MIME_TO_EXT[mimeType]) {
    const error = new Error("Unsupported image type.");
    error.statusCode = 400;
    throw error;
  }

  const key = buildImageObjectKey(originalName, mimeType);
  return putObject({ buffer, key, mimeType });
}

async function uploadVideo({ buffer, originalName, mimeType }) {
  if (!ALLOWED_VIDEO_MIME_TO_EXT[mimeType]) {
    const error = new Error("Unsupported video type. Allowed: MP4, WebM, QuickTime.");
    error.statusCode = 400;
    throw error;
  }

  const key = buildVideoObjectKey(originalName, mimeType);
  return putObject({ buffer, key, mimeType });
}

async function deleteObject(objectKey, options = {}) {
  const key = assertSafeObjectKey(objectKey, options);
  loadR2Config();
  const bucket = getR2BucketName();

  if (bucket !== REQUIRED_BUCKET) {
    const error = new Error("Invalid AURA R2 bucket configuration.");
    error.statusCode = 500;
    throw error;
  }

  const client = getR2Client();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return { key, deleted: true, bucket };
  } catch (err) {
    const error = new Error("Failed to delete file from storage.");
    error.statusCode = 502;
    error.cause = err;
    throw error;
  }
}

async function deleteImage(objectKey) {
  return deleteObject(objectKey, { kind: "image" });
}

async function deleteVideo(objectKey) {
  return deleteObject(objectKey, { kind: "video" });
}

module.exports = {
  ALLOWED_MIME_TO_EXT,
  ALLOWED_IMAGE_MIME_TO_EXT,
  ALLOWED_VIDEO_MIME_TO_EXT,
  uploadImage,
  uploadVideo,
  deleteImage,
  deleteVideo,
  deleteObject,
  assertSafeObjectKey,
};
