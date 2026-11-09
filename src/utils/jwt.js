const jwt = require("jsonwebtoken");
const ApiError = require("./ApiError");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new ApiError(
      500,
      "JWT_SECRET is not configured (minimum 16 characters)."
    );
  }
  return secret;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN?.trim() || "7d";
}

function signAdminToken(admin) {
  const payload = {
    sub: String(admin._id || admin.id),
    username: admin.username,
    email: admin.email,
    role: "admin",
  };
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
}

function verifyAdminToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    if (error && error.name === "TokenExpiredError") {
      throw new ApiError(401, "Session expired. Please sign in again.");
    }
    throw new ApiError(401, "Authentication required.");
  }
}

module.exports = {
  signAdminToken,
  verifyAdminToken,
  getJwtSecret,
  getJwtExpiresIn,
};
