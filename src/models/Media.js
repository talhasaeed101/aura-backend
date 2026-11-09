const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 255 },
    displayName: { type: String, required: true, trim: true, maxlength: 255 },
    kind: {
      type: String,
      required: true,
      enum: ["image", "document", "video"],
      index: true,
    },
    url: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, unique: true },
    alt: { type: String, default: "", trim: true, maxlength: 300 },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    sizeLabel: { type: String, required: true, trim: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    usageLabel: { type: String, default: "", trim: true, maxlength: 120 },
    usedIn: { type: [String], default: [] },
    uploadedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

mediaSchema.index({ displayName: "text", name: "text", usageLabel: "text", alt: "text" });

module.exports = mongoose.model("Media", mediaSchema);
