/**
 * Always allow the known production Admin + public site origins.
 * Additional origins come from CORS_ORIGIN (comma-separated).
 * Never use `*` with credentialed requests.
 */
const REQUIRED_PRODUCTION_ORIGINS = [
  "https://aura-admin-ten-puce.vercel.app",
  "https://auratransport.vercel.app",
];

function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGIN?.trim();
  const fromEnv = raw
    ? raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return [...new Set([...REQUIRED_PRODUCTION_ORIGINS, ...fromEnv])];
}

function isLocalDevOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isOriginAllowed(origin) {
  if (!origin) return false;

  if (getAllowedOrigins().includes(origin)) {
    return true;
  }

  // Localhost only outside Vercel/production (avoid CSRF via SameSite=None cookies).
  const lockedDown =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (!lockedDown && isLocalDevOrigin(origin)) {
    return true;
  }

  return false;
}

module.exports = {
  REQUIRED_PRODUCTION_ORIGINS,
  getAllowedOrigins,
  isOriginAllowed,
};
