const { randomUUID } = require("crypto");
const Inquiry = require("../models/Inquiry");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const parseObjectId = require("../utils/parseId");
const { parsePagination, paginatedResult } = require("../utils/pagination");
const { toClientDoc, toClientDocs } = require("../utils/document");
const { sendSuccess } = require("../utils/response");
const { logActivity } = require("../services/activityService");

function buildInquiryFilter(query) {
  const filter = {};

  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }

  if (query.type && query.type !== "all") {
    filter.inquiryType = query.type;
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  if (query.q && String(query.q).trim()) {
    const q = String(query.q).trim();
    filter.$or = [
      { name: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
      { phone: new RegExp(q, "i") },
      { company: new RegExp(q, "i") },
      { subject: new RegExp(q, "i") },
      { message: new RegExp(q, "i") },
    ];
  }

  return filter;
}

function buildInquirySort(sortKey) {
  switch (sortKey) {
    case "received_asc":
      return { createdAt: 1 };
    case "name_asc":
      return { name: 1 };
    case "name_desc":
      return { name: -1 };
    case "received_desc":
    default:
      return { createdAt: -1 };
  }
}

const createPublicInquiry = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const required = ["name", "email", "inquiryType", "subject", "message"];
  for (const field of required) {
    if (!body[field] || !String(body[field]).trim()) {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const inquiry = await Inquiry.create({
    name: String(body.name).trim(),
    email: String(body.email).trim().toLowerCase(),
    phone: body.phone ? String(body.phone).trim() : "",
    company: body.company ? String(body.company).trim() : "",
    inquiryType: body.inquiryType,
    subject: String(body.subject).trim(),
    message: String(body.message).trim(),
    requestedDate: body.requestedDate ? new Date(body.requestedDate) : null,
    passengerCount:
      body.passengerCount === undefined || body.passengerCount === null
        ? null
        : Number(body.passengerCount),
    status: "new",
    unread: true,
    notes: [],
  });

  await logActivity({
    kind: "inquiry",
    title: "New inquiry received",
    detail: `${inquiry.name} · ${inquiry.subject}`,
  });

  return sendSuccess(res, {
    status: 201,
    message: "Inquiry submitted.",
    data: {
      id: String(inquiry._id),
      status: inquiry.status,
      createdAt: inquiry.createdAt,
    },
  });
});

const listInquiries = asyncHandler(async (req, res) => {
  const filter = buildInquiryFilter(req.query);
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const sort = buildInquirySort(req.query.sort);

  const [items, total] = await Promise.all([
    Inquiry.find(filter).sort(sort).skip(skip).limit(limit),
    Inquiry.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    message: "Inquiries retrieved.",
    data: paginatedResult({
      items: toClientDocs(items),
      total,
      page,
      limit,
    }),
  });
});

const getInquirySummary = asyncHandler(async (_req, res) => {
  const [total, newCount, inProgress, replied, closed] = await Promise.all([
    Inquiry.countDocuments({}),
    Inquiry.countDocuments({ status: "new" }),
    Inquiry.countDocuments({ status: "in_progress" }),
    Inquiry.countDocuments({ status: "replied" }),
    Inquiry.countDocuments({ status: "closed" }),
  ]);

  return sendSuccess(res, {
    message: "Inquiry summary retrieved.",
    data: { total, newCount, inProgress, replied, closed },
  });
});

const getInquiryById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "inquiry");
  const item = await Inquiry.findById(id);
  if (!item) throw new ApiError(404, "Inquiry not found.");
  return sendSuccess(res, {
    message: "Inquiry retrieved.",
    data: toClientDoc(item),
  });
});

const updateInquiryStatus = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "inquiry");
  const { status } = req.body || {};
  if (!["new", "in_progress", "replied", "closed"].includes(status)) {
    throw new ApiError(400, "Invalid inquiry status.");
  }

  const item = await Inquiry.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );
  if (!item) throw new ApiError(404, "Inquiry not found.");

  await logActivity({
    kind: "inquiry",
    title: "Inquiry status updated",
    detail: `${item.name} → ${status}`,
  });

  return sendSuccess(res, {
    message: "Inquiry status updated.",
    data: toClientDoc(item),
  });
});

const updateInquiryUnread = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "inquiry");
  if (typeof req.body?.unread !== "boolean") {
    throw new ApiError(400, "unread boolean is required.");
  }

  const item = await Inquiry.findByIdAndUpdate(
    id,
    { unread: req.body.unread },
    { new: true, runValidators: true }
  );
  if (!item) throw new ApiError(404, "Inquiry not found.");

  return sendSuccess(res, {
    message: "Inquiry unread state updated.",
    data: toClientDoc(item),
  });
});

const addInquiryNote = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "inquiry");
  const body = String(req.body?.body || "").trim();
  const authorName = String(req.body?.authorName || "Admin").trim();

  if (!body) throw new ApiError(400, "Note body is required.");

  const item = await Inquiry.findById(id);
  if (!item) throw new ApiError(404, "Inquiry not found.");

  const now = new Date();
  const note = {
    id: randomUUID(),
    body,
    authorName,
    createdAt: now,
    updatedAt: now,
  };

  item.notes.push(note);
  await item.save();

  await logActivity({
    kind: "inquiry",
    title: "Inquiry note added",
    detail: item.subject,
  });

  return sendSuccess(res, {
    status: 201,
    message: "Note added.",
    data: toClientDoc(item),
  });
});

const deleteInquiryNote = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "inquiry");
  const noteId = String(req.params.noteId || "").trim();
  if (!noteId) throw new ApiError(400, "Note id is required.");

  const item = await Inquiry.findById(id);
  if (!item) throw new ApiError(404, "Inquiry not found.");

  const before = item.notes.length;
  item.notes = item.notes.filter((note) => note.id !== noteId);
  if (item.notes.length === before) {
    throw new ApiError(404, "Note not found.");
  }

  await item.save();

  return sendSuccess(res, {
    message: "Note deleted.",
    data: toClientDoc(item),
  });
});

const deleteInquiry = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id, "inquiry");
  const item = await Inquiry.findByIdAndDelete(id);
  if (!item) throw new ApiError(404, "Inquiry not found.");

  await logActivity({
    kind: "inquiry",
    title: "Inquiry deleted",
    detail: item.subject,
  });

  return sendSuccess(res, {
    message: "Inquiry deleted.",
    data: { id },
  });
});

module.exports = {
  createPublicInquiry,
  listInquiries,
  getInquirySummary,
  getInquiryById,
  updateInquiryStatus,
  updateInquiryUnread,
  addInquiryNote,
  deleteInquiryNote,
  deleteInquiry,
};
