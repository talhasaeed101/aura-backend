const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: ["inquiry", "publish", "fleet", "content", "media", "settings"],
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    detail: { type: String, default: "", trim: true, maxlength: 500 },
    at: { type: Date, default: Date.now, index: true },
    actorId: { type: String, default: null },
  },
  { timestamps: false }
);

module.exports = mongoose.model("Activity", activitySchema);
