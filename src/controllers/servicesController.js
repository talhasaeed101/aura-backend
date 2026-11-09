const Service = require("../models/Service");
const createContentControllers = require("../utils/contentCrudFactory");

module.exports = createContentControllers({
  Model: Service,
  resourceLabel: "Service",
  activityKind: "content",
  fields: [
    "title",
    "slug",
    "shortDescription",
    "fullDescription",
    "category",
    "displayOrder",
    "featured",
    "publishStatus",
    "imageSrc",
    "seoTitle",
    "seoDescription",
  ],
});
