const mongoose = require("mongoose");

const BLOG_CATEGORIES = [
  "executive_travel",
  "enterprise_mobility",
  "airport",
  "protocol",
  "operations",
  "insights",
];

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    excerpt: { type: String, required: true, trim: true, maxlength: 500 },
    content: { type: String, required: true, trim: true, maxlength: 50000 },
    category: { type: String, required: true, enum: BLOG_CATEGORIES },
    author: { type: String, required: true, trim: true, maxlength: 120 },
    featured: { type: Boolean, default: false },
    publishStatus: {
      type: String,
      required: true,
      enum: ["published", "draft"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date, default: null },
    imageSrc: { type: String, default: "", trim: true },
    seoTitle: { type: String, default: "", trim: true, maxlength: 120 },
    seoDescription: { type: String, default: "", trim: true, maxlength: 320 },
  },
  { timestamps: true }
);

blogPostSchema.index({ title: "text", excerpt: "text", slug: "text", author: "text" });

module.exports = mongoose.model("BlogPost", blogPostSchema);
module.exports.BLOG_CATEGORIES = BLOG_CATEGORIES;
