const express = require("express");
const {
  uploadImageHandler,
  uploadImagesHandler,
  uploadVideoHandler,
  deleteImageHandler,
  deleteVideoHandler,
} = require("../controllers/uploadController");
const {
  uploadImageMiddleware,
  uploadImagesMiddleware,
  uploadVideoMiddleware,
  handleMulterErrors,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

function runUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        return handleMulterErrors(err, req, res, next);
      }
      return next();
    });
  };
}

router.post("/image", runUpload(uploadImageMiddleware), uploadImageHandler);
router.post("/images", runUpload(uploadImagesMiddleware), uploadImagesHandler);
router.post("/video", runUpload(uploadVideoMiddleware), uploadVideoHandler);

// Wildcard captures nested keys like uploads/<uuid>.jpg or videos/<uuid>.mp4
router.delete("/image/*key", deleteImageHandler);
router.delete("/video/*key", deleteVideoHandler);

module.exports = router;
