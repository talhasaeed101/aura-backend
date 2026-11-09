const express = require("express");
const {
  createPublicInquiry,
  listInquiries,
  getInquirySummary,
  getInquiryById,
  updateInquiryStatus,
  updateInquiryUnread,
  addInquiryNote,
  deleteInquiryNote,
  deleteInquiry,
} = require("../controllers/inquiriesController");

const adminRouter = express.Router();
const publicRouter = express.Router();

adminRouter.get("/", listInquiries);
adminRouter.get("/summary", getInquirySummary);
adminRouter.get("/:id", getInquiryById);
adminRouter.patch("/:id/status", updateInquiryStatus);
adminRouter.patch("/:id/unread", updateInquiryUnread);
adminRouter.post("/:id/notes", addInquiryNote);
adminRouter.delete("/:id/notes/:noteId", deleteInquiryNote);
adminRouter.delete("/:id", deleteInquiry);

publicRouter.post("/", createPublicInquiry);

module.exports = { adminRouter, publicRouter };
