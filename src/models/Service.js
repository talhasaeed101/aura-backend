const mongoose = require("mongoose");

const SERVICE_CATEGORIES = [
  "corporate",
  "airport",
  "chauffeur",
  "events",
  "fleet_solutions",
  "vip",
];

const serviceSchema = new mongoose.Schema(
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
    shortDescription: { type: String, required: true, trim: true, maxlength: 400 },
    fullDescription: { type: String, required: true, trim: true, maxlength: 8000 },
    category: { type: String, required: true, enum: SERVICE_CATEGORIES },
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
  },
  { timestamps: true }
);

serviceSchema.index({ title: "text", shortDescription: "text", slug: "text" });

module.exports = mongoose.model("Service", serviceSchema);
module.exports.SERVICE_CATEGORIES = SERVICE_CATEGORIES;
