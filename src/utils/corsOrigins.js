function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) {
    try {
      const url = new URL(origin);
      return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }
  return allowed.includes(origin);
}

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
};
