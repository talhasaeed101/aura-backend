const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "aura_admin_token";

function parseExpiresInToMs(value) {
  const raw = String(value || "7d").trim();
  const match = raw.match(/^(\d+)([smhd])$/i);
  if (!match) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    return 7 * 24 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

/**
 * Admin (aura-admin-*.vercel.app) and API (aura-backend-*.vercel.app) are
 * cross-site: `vercel.app` is on the public suffix list, so each subdomain is
 * its own site. Credentialed fetch therefore requires SameSite=None; Secure.
 *
 * Do NOT key this only off NODE_ENV — Vercel may run with NODE_ENV=development
 * while still serving HTTPS cross-origin traffic.
 */
function useCrossSiteAuthCookie() {
  const override = String(process.env.AUTH_COOKIE_SAMESITE || "")
    .trim()
    .toLowerCase();
  if (override === "none") return true;
  if (override === "lax" || override === "strict") return false;

  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function getCookieOptions() {
  const maxAge = parseExpiresInToMs(process.env.JWT_EXPIRES_IN);
  const crossSite = useCrossSiteAuthCookie();

  return {
    httpOnly: true,
    // SameSite=None requires Secure. Local HTTP keeps Lax without Secure.
    secure: crossSite,
    sameSite: crossSite ? "none" : "lax",
    path: "/",
    maxAge,
    // Never set Domain to the admin host — omit Domain so the cookie stays on the API host.
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, getCookieOptions());
}

function clearAuthCookie(res) {
  const options = getCookieOptions();
  res.clearCookie(COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
}

function readAuthToken(req) {
  const value = req.cookies?.[COOKIE_NAME];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

module.exports = {
  COOKIE_NAME,
  parseExpiresInToMs,
  useCrossSiteAuthCookie,
  getCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  readAuthToken,
};
