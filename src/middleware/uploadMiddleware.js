const multer = require("multer");
const path = require("path");
const {
  ALLOWED_IMAGE_MIME_TO_EXT,
  ALLOWED_VIDEO_MIME_TO_EXT,
} = require("../services/r2StorageService");

const MAX_IMAGE_SIZE_BYTES =
  (Number(process.env.MAX_IMAGE_SIZE_MB) > 0
    ? Number(process.env.MAX_IMAGE_SIZE_MB)
    : 5) *
  1024 *
  1024;

const MAX_VIDEO_SIZE_BYTES =
  (Number(process.env.MAX_VIDEO_SIZE_MB) > 0
    ? Number(process.env.MAX_VIDEO_SIZE_MB)
    : 100) *
  1024 *
  1024;

const MAX_MULTI_IMAGES = 12;

const storage = multer.memoryStorage();

function imageFileFilter(req, file, cb) {
  const allowedExts = ALLOWED_IMAGE_MIME_TO_EXT[file.mimetype];

  if (!allowedExts) {
    const error = new Error(
      "Invalid file type. Allowed types: JPEG, PNG, WebP, AVIF."
    );
    error.statusCode = 400;
    return cb(error);
  }

  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext && !allowedExts.includes(ext)) {
    const error = new Error(
      "File extension does not match the detected image type."
    );
    error.statusCode = 400;
    return cb(error);
  }

  return cb(null, true);
}

function videoFileFilter(req, file, cb) {
  const allowedExts = ALLOWED_VIDEO_MIME_TO_EXT[file.mimetype];

  if (!allowedExts) {
    const error = new Error(
      "Invalid video type. Allowed types: MP4, WebM, MOV."
    );
    error.statusCode = 400;
    return cb(error);
  }

  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext && !allowedExts.includes(ext)) {
    const error = new Error(
      "File extension does not match the detected video type."
    );
    error.statusCode = 400;
    return cb(error);
  }

  return cb(null, true);
}

const uploadImageMiddleware = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: imageFileFilter,
}).single("image");

const uploadImagesMiddleware = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: MAX_MULTI_IMAGES },
  fileFilter: imageFileFilter,
}).array("images", MAX_MULTI_IMAGES);

const uploadVideoMiddleware = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE_BYTES, files: 1 },
  fileFilter: videoFileFilter,
}).single("video");

function handleMulterErrors(err, req, res, next) {
  if (!err) {
    return next();
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Uploaded file exceeds the configured size limit.",
        errors: [],
      });
    }

    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Too many files or unexpected upload field.",
        errors: [],
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid upload request.",
      errors: [],
    });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message || "Invalid upload request.",
      errors: [],
    });
  }

  return next(err);
}

module.exports = {
  uploadImageMiddleware,
  uploadImagesMiddleware,
  uploadVideoMiddleware,
  handleMulterErrors,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_MULTI_IMAGES,
};
