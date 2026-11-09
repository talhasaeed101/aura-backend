const ApiError = require("../utils/ApiError");
const { isOriginAllowed } = require("../utils/corsOrigins");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfOriginCheck(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get("Origin");
  if (origin) {
    if (!isOriginAllowed(origin)) {
      return next(new ApiError(403, "Request origin is not allowed."));
    }
    return next();
  }

  const referer = req.get("Referer");
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!isOriginAllowed(refererOrigin)) {
        return next(new ApiError(403, "Request origin is not allowed."));
      }
      return next();
    } catch {
      return next(new ApiError(403, "Request origin is not allowed."));
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  return next(new ApiError(403, "Missing request origin."));
}

module.exports = csrfOriginCheck;
