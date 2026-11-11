const { ensureDbConnected } = require("../config/db");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Block route handlers until MongoDB is connected.
 * Prevents Mongoose queries from running while disconnected.
 */
const requireDatabase = asyncHandler(async (_req, _res, next) => {
  try {
    await ensureDbConnected();
  } catch {
    throw new ApiError(
      503,
      "Database unavailable. Please try again shortly."
    );
  }
  next();
});

module.exports = requireDatabase;
