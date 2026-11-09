const UseCase = require("../models/UseCase");
const createContentControllers = require("../utils/contentCrudFactory");

module.exports = createContentControllers({
  Model: UseCase,
  resourceLabel: "Use case",
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
