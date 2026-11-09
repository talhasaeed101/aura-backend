const mongoose = require("mongoose");
const { sendError } = require("../utils/response");
const ApiError = require("../utils/ApiError");

function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = Array.isArray(err.errors) ? err.errors : [];

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = "Validation failed.";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path || "value"}.`;
  } else if (err && err.code === 11000) {
    status = 409;
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    message = fields.length
      ? `Duplicate value for: ${fields.join(", ")}.`
      : "Duplicate key conflict.";
    errors = fields.map((field) => ({
      field,
      message: `${field} must be unique.`,
    }));
  }

  if (status >= 500 && status !== 502) {
    console.error(err);
    if (process.env.NODE_ENV === "production") {
      message = "Internal server error";
      errors = [];
    }
  }

  return sendError(res, { status, message, errors });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
