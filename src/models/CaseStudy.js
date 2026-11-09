const mongoose = require("mongoose");

const CASE_STUDY_INDUSTRIES = [
  "corporate",
  "diplomatic",
  "events",
  "aviation",
  "hospitality",
  "technology",
];

const caseStudySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    organizationLabel: { type: String, required: true, trim: true, maxlength: 160 },
    industry: { type: String, required: true, enum: CASE_STUDY_INDUSTRIES },
    shortSummary: { type: String, required: true, trim: true, maxlength: 500 },
    challenge: { type: String, required: true, trim: true, maxlength: 4000 },
    approach: { type: String, required: true, trim: true, maxlength: 4000 },
    outcome: { type: String, required: true, trim: true, maxlength: 4000 },
    displayOrder: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    publishStatus: {
      type: String,
      required: true,
      enum: ["published", "draft"],
      default: "draft",
      index: true,
    },
    imageSrc: { type: String, default: "", trim: true },
    seoTitle: { type: String, default: "", trim: true, maxlength: 120 },
    seoDescription: { type: String, default: "", trim: true, maxlength: 320 },
    isDemoContent: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

caseStudySchema.index({ title: "text", shortSummary: "text", slug: "text" });

module.exports = mongoose.model("CaseStudy", caseStudySchema);
module.exports.CASE_STUDY_INDUSTRIES = CASE_STUDY_INDUSTRIES;
