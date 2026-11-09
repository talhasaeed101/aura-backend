const {
  uploadImage,
  uploadVideo,
  deleteImage,
  deleteVideo,
} = require("../services/r2StorageService");
const {
  persistMediaAfterUpload,
  deleteMediaByKey,
} = require("../services/mediaRecordService");
const { logActivity } = require("../services/activityService");
const { toClientDoc } = require("../utils/document");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/response");

function decodeKeyParam(keyParam) {
  let value = keyParam;
  if (Array.isArray(value)) {
    value = value.join("/");
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "Object key is required.");
  }
  try {
    return decodeURIComponent(value.trim());
  } catch (_err) {
    throw new ApiError(400, "Invalid object key encoding.");
  }
}

function mediaPayloadFromUpload({ file, result, kind }) {
  return {
    name: file.originalname || result.key.split("/").pop(),
    displayName: file.originalname || result.key.split("/").pop(),
    kind,
    url: result.url,
    key: result.key,
    mimeType: result.contentType,
    sizeBytes: result.size,
    width: null,
    height: null,
  };
}

async function persistImageUpload(file, result) {
  return persistMediaAfterUpload(
    mediaPayloadFromUpload({ file, result, kind: "image" }),
    (key) => deleteImage(key)
  );
}

async function persistVideoUpload(file, result) {
  return persistMediaAfterUpload(
    mediaPayloadFromUpload({ file, result, kind: "video" }),
    (key) => deleteVideo(key)
  );
}

const uploadImageHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(
      400,
      'Image file is required. Use form field name "image".'
    );
  }

  const result = await uploadImage({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
  });

  const media = await persistImageUpload(req.file, result);

  await logActivity({
    kind: "media",
    title: "Image uploaded",
    detail: media.displayName,
  });

  return sendSuccess(res, {
    status: 201,
    message: "Image uploaded successfully.",
    data: {
      url: result.url,
      key: result.key,
      originalName: req.file.originalname,
      mimeType: result.contentType,
      size: result.size,
      media: toClientDoc(media),
    },
  });
});

const uploadImagesHandler = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    throw new ApiError(
      400,
      'At least one image is required. Use form field name "images".'
    );
  }

  const uploaded = [];
  const failures = [];

  for (const file of files) {
    try {
      const result = await uploadImage({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      });

      const media = await persistImageUpload(file, result);

      uploaded.push({
        name: media.name,
        displayName: media.displayName,
        url: media.url,
        key: media.key,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        sizeLabel: media.sizeLabel,
        width: media.width,
        height: media.height,
        uploadedAt: media.uploadedAt,
        id: String(media._id),
      });
    } catch (error) {
      failures.push({
        originalName: file.originalname,
        message: error.message || "Upload failed.",
        key: error.r2CleanupKey || undefined,
        r2CleanupFailed: Boolean(error.r2CleanupFailed) || undefined,
      });
    }
  }

  if (uploaded.length) {
    await logActivity({
      kind: "media",
      title: "Images uploaded",
      detail: `${uploaded.length} image(s) uploaded`,
    });
  }

  if (!uploaded.length) {
    throw new ApiError(502, "All image uploads failed.", failures);
  }

  const status = failures.length ? 207 : 201;
  return sendSuccess(res, {
    status,
    message: failures.length
      ? "Some images uploaded successfully; others failed."
      : "Images uploaded successfully.",
    data: {
      items: uploaded,
      failed: failures,
      uploadedCount: uploaded.length,
      failedCount: failures.length,
    },
  });
});

const uploadVideoHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(
      400,
      'Video file is required. Use form field name "video".'
    );
  }

  const result = await uploadVideo({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
  });

  const media = await persistVideoUpload(req.file, result);

  await logActivity({
    kind: "media",
    title: "Video uploaded",
    detail: media.displayName,
  });

  return sendSuccess(res, {
    status: 201,
    message: "Video uploaded successfully.",
    data: {
      url: result.url,
      key: result.key,
      originalName: req.file.originalname,
      mimeType: result.contentType,
      size: result.size,
      media: toClientDoc(media),
    },
  });
});

const deleteImageHandler = asyncHandler(async (req, res) => {
  const decodedKey = decodeKeyParam(req.params.key);
  const result = await deleteImage(decodedKey);
  const removed = await deleteMediaByKey(result.key);

  await logActivity({
    kind: "media",
    title: "Image deleted",
    detail: result.key,
  });

  return sendSuccess(res, {
    message: "Image deleted successfully.",
    data: {
      key: result.key,
      deleted: result.deleted,
      mediaDeleted: Boolean(removed),
    },
  });
});

const deleteVideoHandler = asyncHandler(async (req, res) => {
  const decodedKey = decodeKeyParam(req.params.key);
  const result = await deleteVideo(decodedKey);
  const removed = await deleteMediaByKey(result.key);

  await logActivity({
    kind: "media",
    title: "Video deleted",
    detail: result.key,
  });

  return sendSuccess(res, {
    message: "Video deleted successfully.",
    data: {
      key: result.key,
      deleted: result.deleted,
      mediaDeleted: Boolean(removed),
    },
  });
});

module.exports = {
  uploadImageHandler,
  uploadImagesHandler,
  uploadVideoHandler,
  deleteImageHandler,
  deleteVideoHandler,
};
