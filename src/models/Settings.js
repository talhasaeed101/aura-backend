const mongoose = require("mongoose");

const socialLinkSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    platform: {
      type: String,
      required: true,
      enum: ["instagram", "facebook", "linkedin", "tiktok", "youtube", "x"],
    },
    url: { type: String, required: true, trim: true, maxlength: 240 },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    company: {
      companyName: { type: String, default: "AURA", trim: true, maxlength: 80 },
      shortDescription: { type: String, default: "", trim: true, maxlength: 320 },
      logoRef: { type: String, default: "", trim: true, maxlength: 200 },
      faviconRef: { type: String, default: "", trim: true, maxlength: 200 },
    },
    contact: {
      phone: { type: String, default: "", trim: true, maxlength: 40 },
      email: { type: String, default: "", trim: true, maxlength: 120 },
      address: { type: String, default: "", trim: true, maxlength: 240 },
      whatsapp: { type: String, default: "", trim: true, maxlength: 40 },
      officeHours: { type: String, default: "", trim: true, maxlength: 120 },
    },
    socialLinks: { type: [socialLinkSchema], default: [] },
    seo: {
      metaTitle: { type: String, default: "", trim: true, maxlength: 60 },
      metaDescription: { type: String, default: "", trim: true, maxlength: 160 },
      ogImageRef: { type: String, default: "", trim: true, maxlength: 200 },
    },
    sharedCta: {
      heading: { type: String, default: "", trim: true, maxlength: 120 },
      description: { type: String, default: "", trim: true, maxlength: 320 },
      buttonLabel: { type: String, default: "", trim: true, maxlength: 48 },
      buttonUrl: { type: String, default: "", trim: true, maxlength: 200 },
    },
    preferences: {
      tablePageSize: {
        type: Number,
        enum: [5, 6, 8, 10, 12],
        default: 8,
      },
      dateDisplayFormat: {
        type: String,
        enum: ["dd_mmm_yyyy", "yyyy_mm_dd", "mmm_dd_yyyy"],
        default: "dd_mmm_yyyy",
      },
      confirmBeforeDelete: { type: Boolean, default: true },
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

module.exports = mongoose.model("Settings", settingsSchema);
