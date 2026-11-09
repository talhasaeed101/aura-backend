const BlogPost = require("../models/BlogPost");
const createContentControllers = require("../utils/contentCrudFactory");

module.exports = createContentControllers({
  Model: BlogPost,
  resourceLabel: "Blog post",
  activityKind: "content",
  fields: [
    "title",
    "slug",
    "excerpt",
    "content",
    "category",
    "author",
    "featured",
    "publishStatus",
    "publishedAt",
    "imageSrc",
    "seoTitle",
    "seoDescription",
  ],
  onPublish(payload) {
    if (payload.publishStatus === "published" && !payload.publishedAt) {
      payload.publishedAt = new Date();
    }
    if (payload.publishStatus === "draft") {
      payload.publishedAt = null;
    }
  },
  buildDuplicate(source) {
    return {
      ...source,
      title: `${source.title} (Copy)`,
      publishStatus: "draft",
      featured: false,
      publishedAt: null,
    };
  },
});
