const mongoose = require("mongoose");

const INQUIRY_TYPES = [
  "airport_transfer",
  "executive_day",
  "event_coverage",
  "retainer",
  "protocol",
  "general",
];

const INQUIRY_STATUSES = ["new", "in_progress", "replied", "closed"];

const inquiryNoteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    authorName: { type: String, required: true, trim: true, maxlength: 120 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const inquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, default: "", trim: true, maxlength: 40 },
    company: { type: String, default: "", trim: true, maxlength: 160 },
    inquiryType: { type: String, required: true, enum: INQUIRY_TYPES },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    requestedDate: { type: Date, default: null },
    passengerCount: { type: Number, default: null, min: 1, max: 100 },
    status: {
      type: String,
      required: true,
      enum: INQUIRY_STATUSES,
      default: "new",
      index: true,
    },
    unread: { type: Boolean, default: true, index: true },
    notes: { type: [inquiryNoteSchema], default: [] },
  },
  { timestamps: true }
);

inquirySchema.index({
  name: "text",
  email: "text",
  company: "text",
  subject: "text",
  message: "text",
});

module.exports = mongoose.model("Inquiry", inquirySchema);
module.exports.INQUIRY_TYPES = INQUIRY_TYPES;
module.exports.INQUIRY_STATUSES = INQUIRY_STATUSES;
