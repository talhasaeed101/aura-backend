const express = require("express");
const {
  listMedia,
  getMediaSummary,
  getMediaById,
  createMedia,
  updateMedia,
  deleteMedia,
} = require("../controllers/mediaController");

const router = express.Router();

router.get("/", listMedia);
router.get("/summary", getMediaSummary);
router.get("/:id", getMediaById);
router.post("/", createMedia);
router.patch("/:id", updateMedia);
router.delete("/:id", deleteMedia);

module.exports = router;
