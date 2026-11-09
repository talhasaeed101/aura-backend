const asyncHandler = require("./asyncHandler");
const ApiError = require("./ApiError");
const parseObjectId = require("./parseId");
const { parsePagination, paginatedResult } = require("./pagination");
const { toClientDoc, toClientDocs } = require("./document");
const { sendSuccess } = require("./response");
const { slugify, ensureUniqueSlug } = require("./slugify");
const { logActivity } = require("../services/activityService");

function createContentControllers({
  Model,
  resourceLabel,
  fields,
  categoryField = "category",
  activityKind = "content",
  publicExtraFilter = null,
  onPublish = null,
  buildDuplicate = null,
}) {
  function buildFilter(query, { publicOnly = false } = {}) {
    const filter = {};

    if (publicOnly) {
      filter.publishStatus = "published";
      if (publicExtraFilter) {
        Object.assign(filter, publicExtraFilter);
      }
    } else if (query.publish && query.publish !== "all") {
      filter.publishStatus = query.publish;
    }

    if (query[categoryField] && query[categoryField] !== "all") {
      filter[categoryField] = query[categoryField];
    }

    if (query.featured === "true" || query.featured === "featured") {
      filter.featured = true;
    } else if (
      query.featured === "false" ||
      query.featured === "not_featured"
    ) {
      filter.featured = false;
    }

    if (query.q && String(query.q).trim()) {
      const q = String(query.q).trim();
      filter.$or = [
        { title: new RegExp(q, "i") },
        { slug: new RegExp(q, "i") },
        { shortDescription: new RegExp(q, "i") },
        { shortSummary: new RegExp(q, "i") },
        { excerpt: new RegExp(q, "i") },
        { author: new RegExp(q, "i") },
        { organizationLabel: new RegExp(q, "i") },
      ];
    }

    return filter;
  }

  function buildSort(sortKey) {
    switch (sortKey) {
      case "updated_asc":
        return { updatedAt: 1 };
      case "title_asc":
      case "name_asc":
        return { title: 1 };
      case "title_desc":
      case "name_desc":
        return { title: -1 };
      case "order_asc":
        return { displayOrder: 1, updatedAt: -1 };
      case "published_desc":
        return { publishedAt: -1, updatedAt: -1 };
      case "updated_desc":
      default:
        return { updatedAt: -1 };
    }
  }

  function pickBody(body = {}) {
    const payload = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        payload[field] = body[field];
      }
    }
    return payload;
  }

  const listAdmin = asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query);
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const sort = buildSort(req.query.sort);

    const [items, total] = await Promise.all([
      Model.find(filter).sort(sort).skip(skip).limit(limit),
      Model.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      message: `${resourceLabel} list retrieved.`,
      data: paginatedResult({
        items: toClientDocs(items),
        total,
        page,
        limit,
      }),
    });
  });

  const getSummary = asyncHandler(async (_req, res) => {
    const [total, published, draft, featured] = await Promise.all([
      Model.countDocuments({}),
      Model.countDocuments({ publishStatus: "published" }),
      Model.countDocuments({ publishStatus: "draft" }),
      Model.countDocuments({ featured: true }),
    ]);

    const data = { total, published, draft };
    if (Model.schema.path("featured")) {
      data.featured = featured;
    }

    // Services summary uses recentlyUpdated in admin types — approximate last 30 days.
    if (resourceLabel.toLowerCase().includes("service")) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      data.recentlyUpdated = await Model.countDocuments({
        updatedAt: { $gte: since },
      });
    }

    return sendSuccess(res, {
      message: `${resourceLabel} summary retrieved.`,
      data,
    });
  });

  const getById = asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id, resourceLabel);
    const item = await Model.findById(id);
    if (!item) throw new ApiError(404, `${resourceLabel} not found.`);
    return sendSuccess(res, {
      message: `${resourceLabel} retrieved.`,
      data: toClientDoc(item),
    });
  });

  const create = asyncHandler(async (req, res) => {
    const payload = pickBody(req.body);

    if (!payload.slug && payload.title) {
      payload.slug = await ensureUniqueSlug(Model, payload.title);
    } else if (payload.slug) {
      payload.slug = await ensureUniqueSlug(Model, payload.slug);
    }

    if (typeof onPublish === "function") {
      onPublish(payload, { creating: true });
    }

    const item = await Model.create(payload);

    await logActivity({
      kind: activityKind,
      title: `${resourceLabel} created`,
      detail: item.title || item.name || String(item._id),
    });

    return sendSuccess(res, {
      status: 201,
      message: `${resourceLabel} created.`,
      data: toClientDoc(item),
    });
  });

  const update = asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id, resourceLabel);
    const payload = pickBody(req.body);

    if (payload.slug) {
      payload.slug = await ensureUniqueSlug(Model, payload.slug, id);
    }

    if (typeof onPublish === "function") {
      onPublish(payload, { creating: false });
    }

    const item = await Model.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!item) throw new ApiError(404, `${resourceLabel} not found.`);

    await logActivity({
      kind: activityKind,
      title: `${resourceLabel} updated`,
      detail: item.title || String(item._id),
    });

    return sendSuccess(res, {
      message: `${resourceLabel} updated.`,
      data: toClientDoc(item),
    });
  });

  const togglePublish = asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id, resourceLabel);
    const item = await Model.findById(id);
    if (!item) throw new ApiError(404, `${resourceLabel} not found.`);

    if (req.body && req.body.publishStatus) {
      if (!["published", "draft"].includes(req.body.publishStatus)) {
        throw new ApiError(400, "Invalid publishStatus.");
      }
      item.publishStatus = req.body.publishStatus;
    } else {
      item.publishStatus =
        item.publishStatus === "published" ? "draft" : "published";
    }

    if (Model.schema.path("publishedAt")) {
      if (item.publishStatus === "published") {
        item.publishedAt = item.publishedAt || new Date();
      } else {
        item.publishedAt = null;
      }
    }

    await item.save();

    await logActivity({
      kind: "publish",
      title: `${resourceLabel} publish status changed`,
      detail: `${item.title} → ${item.publishStatus}`,
    });

    return sendSuccess(res, {
      message: `${resourceLabel} publish status updated.`,
      data: toClientDoc(item),
    });
  });

  const toggleFeatured = asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id, resourceLabel);
    const item = await Model.findById(id);
    if (!item) throw new ApiError(404, `${resourceLabel} not found.`);

    if (typeof req.body?.featured === "boolean") {
      item.featured = req.body.featured;
    } else {
      item.featured = !item.featured;
    }

    await item.save();

    await logActivity({
      kind: activityKind,
      title: `${resourceLabel} featured updated`,
      detail: `${item.title} → featured=${item.featured}`,
    });

    return sendSuccess(res, {
      message: `${resourceLabel} featured flag updated.`,
      data: toClientDoc(item),
    });
  });

  const duplicate = asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id, resourceLabel);
    const source = await Model.findById(id).lean();
    if (!source) throw new ApiError(404, `${resourceLabel} not found.`);

    const copy = buildDuplicate
      ? buildDuplicate(source)
      : {
          ...source,
          title: `${source.title} (Copy)`,
          publishStatus: "draft",
          featured: false,
        };

    delete copy._id;
    delete copy.createdAt;
    delete copy.updatedAt;
    delete copy.__v;

    copy.slug = await ensureUniqueSlug(
      Model,
      slugify(copy.slug || copy.title) + "-copy"
    );

    if (Model.schema.path("publishedAt")) {
      copy.publishedAt = null;
      copy.publishStatus = "draft";
    }

    const item = await Model.create(copy);

    await logActivity({
      kind: activityKind,
      title: `${resourceLabel} duplicated`,
      detail: item.title,
    });

    return sendSuccess(res, {
      status: 201,
      message: `${resourceLabel} duplicated.`,
      data: toClientDoc(item),
    });
  });

  const remove = asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id, resourceLabel);
    const item = await Model.findByIdAndDelete(id);
    if (!item) throw new ApiError(404, `${resourceLabel} not found.`);

    await logActivity({
      kind: activityKind,
      title: `${resourceLabel} deleted`,
      detail: item.title || String(id),
    });

    return sendSuccess(res, {
      message: `${resourceLabel} deleted.`,
      data: { id },
    });
  });

  const listPublic = asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query, { publicOnly: true });
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 50,
    });
    const sort = buildSort(req.query.sort || "order_asc");

    const [items, total] = await Promise.all([
      Model.find(filter).sort(sort).skip(skip).limit(limit),
      Model.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      message: `Published ${resourceLabel.toLowerCase()} list retrieved.`,
      data: paginatedResult({
        items: toClientDocs(items),
        total,
        page,
        limit,
      }),
    });
  });

  const getPublicBySlug = asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "")
      .trim()
      .toLowerCase();
    if (!slug) throw new ApiError(400, "Slug is required.");

    const filter = {
      slug,
      publishStatus: "published",
      ...(publicExtraFilter || {}),
    };

    const item = await Model.findOne(filter);
    if (!item) throw new ApiError(404, `${resourceLabel} not found.`);

    return sendSuccess(res, {
      message: `${resourceLabel} retrieved.`,
      data: toClientDoc(item),
    });
  });

  return {
    listAdmin,
    getSummary,
    getById,
    create,
    update,
    togglePublish,
    toggleFeatured,
    duplicate,
    remove,
    listPublic,
    getPublicBySlug,
  };
}

module.exports = createContentControllers;
