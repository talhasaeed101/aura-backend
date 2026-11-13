const mongoose = require("mongoose");

const FLEET_CATEGORIES = [
  "executive_sedan",
  "luxury_sedan",
  "suv",
  "luxury_suv",
  "van",
  "premium_van",
];

const vehicleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    make: { type: String, required: true, trim: true, maxlength: 80 },
    model: { type: String, required: true, trim: true, maxlength: 80 },
    year: { type: Number, required: true, min: 1990, max: 2100 },
    category: {
      type: String,
      required: true,
      enum: FLEET_CATEGORIES,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      unique: true,
    },
    seatingCapacity: { type: Number, required: true, min: 1, max: 20 },
    transmission: {
      type: String,
      required: true,
      enum: ["automatic", "manual"],
    },
    fuelType: {
      type: String,
      required: true,
      enum: ["petrol", "diesel", "hybrid", "electric"],
    },
    availabilityStatus: {
      type: String,
      required: true,
      enum: ["available", "booked", "maintenance"],
      default: "available",
    },
    publishStatus: {
      type: String,
      required: true,
      enum: ["published", "draft"],
      default: "draft",
      index: true,
    },
    shortDescription: { type: String, required: true, trim: true, maxlength: 500 },
    features: { type: [String], default: [] },
    imageSrc: { type: String, default: "", trim: true },
    gallerySlots: { type: Number, default: 0, min: 0, max: 8 },
    displayOrder: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

vehicleSchema.index({ category: 1, publishStatus: 1 });
vehicleSchema.index({ availabilityStatus: 1 });
vehicleSchema.index({ name: "text", make: "text", model: "text", registrationNumber: "text" });

module.exports = mongoose.model("Vehicle", vehicleSchema);
module.exports.FLEET_CATEGORIES = FLEET_CATEGORIES;
