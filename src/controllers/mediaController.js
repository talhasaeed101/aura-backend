const Media = require("../models/Media");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const parseObjectId = require("../utils/parseId");
const { parsePagination, paginatedResult } = require("../utils/pagination");
const { toClientDoc, toClientDocs } = require("../utils/document");
const { sendSuccess } = require("../utils/response");
const formatBytes = require("../utils/formatBytes");
const { logActivity } = require("../services/activityService");
const { deleteObject } = require("../services/r2StorageService");

function buildMediaFilter(query) {
  const filter = {};

  if (query.type && query.type !== "all") {
    filter.kind = query.type;
  }

  if (query.usage && query.usage !== "all") {
    filter.usageLabel = String(query.usage).trim();
  }

  if (query.q && String(query.q).trim()) {
    const q = String(query.q).trim();
    filter.$or = [
      { name: new RegExp(q, "i") },
      { displayName: new RegExp(q, "i") },
      { alt: new RegExp(q, "i") },
      { usageLabel: new RegExp(q, "i") },
      { key: new RegExp(q, "i") },
    ];
  }

  return filter;
}

function buildMediaSort(sortKey) {
  switch (sortKey) {
    case "name_asc":
      return { displayName: 1 };
    case "name_desc":
      return { displayName: -1 };
    case "date_asc":
      return { uploadedAt: 1 };
    case "size_desc":
      return { sizeBytes: -1 };
    case "size_asc":
      return { sizeBytes: 1 };
    case "date_desc":
    default:
      return { uploadedAt: -1 };
  }
}

const listMedia = asyncHandler(async (req, res) => {
  const filter = buildMediaFilter(req.query);
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const sort = buildMediaSort(req.query.sort);

  const [items, total] = await Promise.all([
    Media.find(filter).sort(sort).skip(skip).limit(limit),
    Media.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    message: "Media library retrieved.",
    data: paginatedResult({
      items: toClientDocs(items),
      total,
      page,
      limit,
    }),
  });
});

const getMediaSummary = asyncHandler(async (_req, res) => {
  const asOf = Date.now();
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const recentSince = new Date(asOf - windowMs);

  const [total, images, videos, recentlyAdded] = await Promise.all([
    Media.countDocuments({}),
    Media.countDocuments({ kind: "image" }),
    Media.countDocuments({ kind: "video" }),
    Media.countDocuments({ uploadedAt: { $gte: recentSince } }),
  ]);

  return sendSuccess(res, {
    message: "Media summary retrieved.",
    data: { total, images, videos, recentlyAdded },
  });
});

const getMediaById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "media");
  const item = await Media.findById(id);
  if (!item) throw new ApiError(404, "Media item not found.");
  return sendSuccess(res, {
    message: "Media item retrieved.",
    data: toClientDoc(item),
  });
});

const createMedia = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.url || !body.key || !body.mimeType || !body.kind) {
    throw new ApiError(400, "url, key, mimeType and kind are required.");
  }

  const existing = await Media.findOne({ key: body.key });
  if (existing) {
    throw new ApiError(409, "A media record already exists for this object key.");
  }

  const sizeBytes = Number(body.sizeBytes) || 0;
  const item = await Media.create({
    name: body.name || body.key.split("/").pop(),
    displayName: body.displayName || body.name || body.key.split("/").pop(),
    kind: body.kind,
    url: body.url,
    key: body.key,
    alt: body.alt || "",
    mimeType: body.mimeType,
    sizeBytes,
    sizeLabel: body.sizeLabel || formatBytes(sizeBytes),
    width: body.width ?? null,
    height: body.height ?? null,
    usageLabel: body.usageLabel || "",
    usedIn: Array.isArray(body.usedIn) ? body.usedIn : [],
    uploadedAt: body.uploadedAt ? new Date(body.uploadedAt) : new Date(),
  });

  await logActivity({
    kind: "media",
    title: "Media record created",
    detail: item.displayName,
  });

  return sendSuccess(res, {
    status: 201,
    message: "Media record created.",
    data: toClientDoc(item),
  });
});

const updateMedia = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "media");
  const allowed = ["displayName", "alt", "usageLabel", "usedIn", "name"];
  const payload = {};
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      payload[field] = req.body[field];
    }
  }

  const item = await Media.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!item) throw new ApiError(404, "Media item not found.");

  await logActivity({
    kind: "media",
    title: "Media metadata updated",
    detail: item.displayName,
  });

  return sendSuccess(res, {
    message: "Media metadata updated.",
    data: toClientDoc(item),
  });
});

const deleteMedia = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "media");
  const item = await Media.findById(id);
  if (!item) throw new ApiError(404, "Media item not found.");

  try {
    await deleteObject(item.key, { kind: "any" });
  } catch (error) {
    // Continue deleting DB record if object already gone, but report storage issue for real failures.
    if (error.statusCode && error.statusCode >= 500) {
      throw error;
    }
  }

  await Media.deleteOne({ _id: item._id });

  await logActivity({
    kind: "media",
    title: "Media deleted",
    detail: item.displayName,
  });

  return sendSuccess(res, {
    message: "Media item deleted.",
    data: { id, key: item.key },
  });
});

module.exports = {
  listMedia,
  getMediaSummary,
  getMediaById,
  createMedia,
  updateMedia,
  deleteMedia,
};
