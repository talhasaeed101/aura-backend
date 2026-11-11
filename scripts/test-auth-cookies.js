/**
 * Auth cookie + CORS origin checks (no secrets printed).
 */
require("dotenv").config();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    // Re-require fresh module each time
    const resolved = require.resolve("../src/utils/authCookies");
    delete require.cache[resolved];
    const mod = require("../src/utils/authCookies");
    return fn(mod);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const resolved = require.resolve("../src/utils/authCookies");
    delete require.cache[resolved];
  }
}

function testCookieOptions() {
  withEnv(
    { NODE_ENV: "development", VERCEL: undefined, AUTH_COOKIE_SAMESITE: undefined },
    ({ getCookieOptions, useCrossSiteAuthCookie }) => {
      assert(useCrossSiteAuthCookie() === false, "local should not force cross-site");
      const opts = getCookieOptions();
      assert(opts.httpOnly === true, "httpOnly required");
      assert(opts.sameSite === "lax", "local sameSite should be lax");
      assert(opts.secure === false, "local secure should be false");
      assert(opts.path === "/", "path must be /");
      assert(!("domain" in opts) || opts.domain == null, "domain must not be set");
      console.log("PASS local cookie options (Lax, not Secure)");
    }
  );

  withEnv(
    { NODE_ENV: "development", VERCEL: "1", AUTH_COOKIE_SAMESITE: undefined },
    ({ getCookieOptions, useCrossSiteAuthCookie }) => {
      assert(useCrossSiteAuthCookie() === true, "VERCEL=1 must force cross-site cookies");
      const opts = getCookieOptions();
      assert(opts.sameSite === "none", "Vercel sameSite must be none");
      assert(opts.secure === true, "Vercel cookies must be Secure");
      assert(opts.httpOnly === true, "httpOnly required");
      console.log("PASS Vercel cookie options (None + Secure) even if NODE_ENV=development");
    }
  );

  withEnv(
    { NODE_ENV: "production", VERCEL: undefined, AUTH_COOKIE_SAMESITE: undefined },
    ({ getCookieOptions }) => {
      const opts = getCookieOptions();
      assert(opts.sameSite === "none", "production sameSite must be none");
      assert(opts.secure === true, "production cookies must be Secure");
      console.log("PASS production cookie options (None + Secure)");
    }
  );
}

function testCorsOrigins() {
  const resolved = require.resolve("../src/utils/corsOrigins");
  delete require.cache[resolved];
  const {
    getAllowedOrigins,
    isOriginAllowed,
    REQUIRED_PRODUCTION_ORIGINS,
  } = require("../src/utils/corsOrigins");

  const allowed = getAllowedOrigins();
  for (const origin of REQUIRED_PRODUCTION_ORIGINS) {
    assert(allowed.includes(origin), `missing required origin ${origin}`);
    assert(isOriginAllowed(origin), `required origin not allowed: ${origin}`);
  }
  assert(!allowed.includes("*"), "wildcard origin must never appear");
  console.log("PASS required production CORS origins present (no wildcard)");
}

testCookieOptions();
testCorsOrigins();
console.log("All auth cookie/CORS checks passed.");
