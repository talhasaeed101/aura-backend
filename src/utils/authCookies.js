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

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getCookieOptions() {
  const maxAge = parseExpiresInToMs(process.env.JWT_EXPIRES_IN);
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/",
    maxAge,
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, getCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/",
  });
}

function readAuthToken(req) {
  const value = req.cookies?.[COOKIE_NAME];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

module.exports = {
  COOKIE_NAME,
  parseExpiresInToMs,
  getCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  readAuthToken,
};
