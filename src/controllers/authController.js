const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { setAuthCookie, clearAuthCookie } = require("../utils/authCookies");
const { signAdminToken } = require("../utils/jwt");

const BCRYPT_ROUNDS = 12;
const GENERIC_INVALID = "Invalid credentials.";

function toPublicAdmin(admin) {
  return {
    id: String(admin._id || admin.id),
    username: admin.username,
    email: admin.email,
    role: admin.role || "admin",
  };
}

const login = asyncHandler(async (req, res) => {
  const usernameOrEmail = String(req.body?.usernameOrEmail || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");

  if (!usernameOrEmail || !password) {
    throw new ApiError(400, "Username/email and password are required.");
  }

  const admin = await Admin.findOne({
    $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
  }).select("+passwordHash username email role");

  if (!admin || !admin.passwordHash) {
    throw new ApiError(401, GENERIC_INVALID);
  }

  const matches = await bcrypt.compare(password, admin.passwordHash);
  if (!matches) {
    throw new ApiError(401, GENERIC_INVALID);
  }

  const token = signAdminToken(admin);
  setAuthCookie(res, token);

  return sendSuccess(res, {
    message: "Signed in successfully.",
    data: { admin: toPublicAdmin(admin) },
  });
});

const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: "Admin session retrieved.",
    data: { admin: req.admin },
  });
});

const logout = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  return sendSuccess(res, {
    message: "Signed out successfully.",
    data: null,
  });
});

module.exports = {
  login,
  me,
  logout,
  toPublicAdmin,
  BCRYPT_ROUNDS,
};
