const CaseStudy = require("../models/CaseStudy");
const createContentControllers = require("../utils/contentCrudFactory");

module.exports = createContentControllers({
  Model: CaseStudy,
  resourceLabel: "Case study",
  activityKind: "content",
  categoryField: "industry",
  publicExtraFilter: { isDemoContent: false },
  fields: [
    "title",
    "slug",
    "organizationLabel",
    "industry",
    "shortSummary",
    "challenge",
    "approach",
    "outcome",
    "displayOrder",
    "featured",
    "publishStatus",
    "imageSrc",
    "seoTitle",
    "seoDescription",
    "isDemoContent",
  ],
  buildDuplicate(source) {
    return {
      ...source,
      title: `${source.title} (Copy)`,
      publishStatus: "draft",
      featured: false,
      isDemoContent: true,
    };
  },
});
