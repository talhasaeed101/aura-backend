const Admin = require("../models/Admin");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { readAuthToken } = require("../utils/authCookies");
const { verifyAdminToken } = require("../utils/jwt");

const requireAdminAuth = asyncHandler(async (req, _res, next) => {
  const token = readAuthToken(req);
  if (!token) {
    throw new ApiError(401, "Authentication required.");
  }

  const payload = verifyAdminToken(token);
  if (!payload?.sub || payload.role !== "admin") {
    throw new ApiError(401, "Authentication required.");
  }

  const admin = await Admin.findById(payload.sub).select(
    "username email role createdAt updatedAt"
  );
  if (!admin) {
    throw new ApiError(401, "Authentication required.");
  }

  req.admin = {
    id: String(admin._id),
    username: admin.username,
    email: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };

  next();
});

module.exports = requireAdminAuth;
