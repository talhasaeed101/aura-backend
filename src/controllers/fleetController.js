const Vehicle = require("../models/Vehicle");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const parseObjectId = require("../utils/parseId");
const { parsePagination, paginatedResult } = require("../utils/pagination");
const { toClientDoc, toClientDocs } = require("../utils/document");
const { sendSuccess } = require("../utils/response");
const { logActivity } = require("../services/activityService");

function buildFleetFilter(query, { publicOnly = false } = {}) {
  const filter = {};

  if (publicOnly) {
    filter.publishStatus = "published";
  } else if (query.publish && query.publish !== "all") {
    filter.publishStatus = query.publish;
  }

  if (query.category && query.category !== "all") {
    filter.category = query.category;
  }

  if (query.availability && query.availability !== "all") {
    filter.availabilityStatus = query.availability;
  }

  if (query.q && String(query.q).trim()) {
    const q = String(query.q).trim();
    filter.$or = [
      { name: new RegExp(q, "i") },
      { make: new RegExp(q, "i") },
      { model: new RegExp(q, "i") },
      { registrationNumber: new RegExp(q, "i") },
    ];
  }

  return filter;
}

function buildFleetSort(sortKey) {
  switch (sortKey) {
    case "updated_asc":
      return { updatedAt: 1 };
    case "name_asc":
      return { name: 1 };
    case "name_desc":
      return { name: -1 };
    case "year_desc":
      return { year: -1 };
    case "year_asc":
      return { year: 1 };
    case "updated_desc":
    default:
      return { updatedAt: -1 };
  }
}

function pickVehicleBody(body = {}) {
  const payload = {};
  const fields = [
    "name",
    "make",
    "model",
    "year",
    "category",
    "registrationNumber",
    "seatingCapacity",
    "transmission",
    "fuelType",
    "availabilityStatus",
    "publishStatus",
    "shortDescription",
    "features",
    "imageSrc",
    "gallerySlots",
    "displayOrder",
    "featured",
  ];

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  }

  if (typeof payload.features === "string") {
    payload.features = payload.features
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof payload.registrationNumber === "string") {
    payload.registrationNumber = payload.registrationNumber.trim().toUpperCase();
  }

  return payload;
}

const listAdminFleet = asyncHandler(async (req, res) => {
  const filter = buildFleetFilter(req.query);
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const sort = buildFleetSort(req.query.sort);

  const [items, total] = await Promise.all([
    Vehicle.find(filter).sort(sort).skip(skip).limit(limit),
    Vehicle.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    message: "Fleet vehicles retrieved.",
    data: paginatedResult({
      items: toClientDocs(items),
      total,
      page,
      limit,
    }),
  });
});

const getFleetSummary = asyncHandler(async (_req, res) => {
  const [total, available, booked, maintenance, published] = await Promise.all([
    Vehicle.countDocuments({}),
    Vehicle.countDocuments({ availabilityStatus: "available" }),
    Vehicle.countDocuments({ availabilityStatus: "booked" }),
    Vehicle.countDocuments({ availabilityStatus: "maintenance" }),
    Vehicle.countDocuments({ publishStatus: "published" }),
  ]);

  return sendSuccess(res, {
    message: "Fleet summary retrieved.",
    data: { total, available, booked, maintenance, published },
  });
});

const getFleetById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "vehicle");
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new ApiError(404, "Vehicle not found.");
  return sendSuccess(res, {
    message: "Vehicle retrieved.",
    data: toClientDoc(vehicle),
  });
});

const createFleet = asyncHandler(async (req, res) => {
  const payload = pickVehicleBody(req.body);
  const vehicle = await Vehicle.create(payload);

  await logActivity({
    kind: "fleet",
    title: "Vehicle created",
    detail: vehicle.name,
  });

  return sendSuccess(res, {
    status: 201,
    message: "Vehicle created.",
    data: toClientDoc(vehicle),
  });
});

const updateFleet = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "vehicle");
  const payload = pickVehicleBody(req.body);
  const vehicle = await Vehicle.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!vehicle) throw new ApiError(404, "Vehicle not found.");

  await logActivity({
    kind: "fleet",
    title: "Vehicle updated",
    detail: vehicle.name,
  });

  return sendSuccess(res, {
    message: "Vehicle updated.",
    data: toClientDoc(vehicle),
  });
});

const updateAvailability = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "vehicle");
  const { availabilityStatus } = req.body || {};
  if (!["available", "booked", "maintenance"].includes(availabilityStatus)) {
    throw new ApiError(400, "Invalid availabilityStatus.");
  }

  const vehicle = await Vehicle.findByIdAndUpdate(
    id,
    { availabilityStatus },
    { new: true, runValidators: true }
  );
  if (!vehicle) throw new ApiError(404, "Vehicle not found.");

  await logActivity({
    kind: "fleet",
    title: "Vehicle availability updated",
    detail: `${vehicle.name} → ${availabilityStatus}`,
  });

  return sendSuccess(res, {
    message: "Vehicle availability updated.",
    data: toClientDoc(vehicle),
  });
});

const togglePublish = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "vehicle");
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new ApiError(404, "Vehicle not found.");

  if (req.body && req.body.publishStatus) {
    if (!["published", "draft"].includes(req.body.publishStatus)) {
      throw new ApiError(400, "Invalid publishStatus.");
    }
    vehicle.publishStatus = req.body.publishStatus;
  } else {
    vehicle.publishStatus =
      vehicle.publishStatus === "published" ? "draft" : "published";
  }

  await vehicle.save();

  await logActivity({
    kind: "publish",
    title: "Vehicle publish status changed",
    detail: `${vehicle.name} → ${vehicle.publishStatus}`,
  });

  return sendSuccess(res, {
    message: "Vehicle publish status updated.",
    data: toClientDoc(vehicle),
  });
});

const deleteFleet = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "vehicle");
  const vehicle = await Vehicle.findByIdAndDelete(id);
  if (!vehicle) throw new ApiError(404, "Vehicle not found.");

  await logActivity({
    kind: "fleet",
    title: "Vehicle deleted",
    detail: vehicle.name,
  });

  return sendSuccess(res, {
    message: "Vehicle deleted.",
    data: { id },
  });
});

const listPublicFleet = asyncHandler(async (req, res) => {
  const filter = buildFleetFilter(req.query, { publicOnly: true });
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const sort = buildFleetSort(req.query.sort || "name_asc");

  const [items, total] = await Promise.all([
    Vehicle.find(filter).sort(sort).skip(skip).limit(limit),
    Vehicle.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    message: "Published fleet retrieved.",
    data: paginatedResult({
      items: toClientDocs(items),
      total,
      page,
      limit,
    }),
  });
});

module.exports = {
  listAdminFleet,
  getFleetSummary,
  getFleetById,
  createFleet,
  updateFleet,
  updateAvailability,
  togglePublish,
  deleteFleet,
  listPublicFleet,
};
