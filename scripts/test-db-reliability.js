/**
 * AURA MongoDB reliability suite (local). Never prints secrets.
 */
require("dotenv").config();

const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const {
  connectDB,
  disconnectDB,
  ensureDbConnected,
  getDbHealth,
  probeDbHealth,
  REQUIRED_DB_NAME,
} = require("../src/config/db");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clearSrcCache() {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(`${path.sep}src${path.sep}`) || key.includes(`${path.sep}api${path.sep}`)) {
      delete require.cache[key];
    }
  });
  // Mongoose refuses to recompile models after module cache clears.
  Object.keys(mongoose.models).forEach((name) => {
    delete mongoose.models[name];
  });
  if (mongoose.connection?.models) {
    Object.keys(mongoose.connection.models).forEach((name) => {
      delete mongoose.connection.models[name];
    });
  }
}

function request(server, { method, path: reqPath, body, headers }) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        method,
        path: reqPath,
        headers: { "Content-Type": "application/json", ...(headers || {}) },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, body: json, ms: Date.now() - started });
        });
      }
    );
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

async function withAppServer(fn) {
  clearSrcCache();
  const app = require("../src/app");
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    return await fn(server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  console.log("1) Successful MongoDB connection");
  await disconnectDB();
  await ensureDbConnected();
  assert(getDbHealth().connected === true, "not connected");
  assert(getDbHealth().name === REQUIRED_DB_NAME, "wrong db");
  console.log("PASS");

  console.log("2) Concurrent ensureDbConnected");
  const results = await Promise.all(Array.from({ length: 12 }, () => ensureDbConnected()));
  assert(results.every((h) => h.connected), "concurrent failed");
  console.log("PASS");

  console.log("3) Warm connection reuse");
  const conn = mongoose.connection;
  await connectDB();
  await connectDB();
  assert(mongoose.connection === conn, "reuse failed");
  console.log("PASS");

  console.log("4) Reconnect after disconnect (cold-ish)");
  await disconnectDB();
  await ensureDbConnected();
  assert(getDbHealth().connected === true, "reconnect failed");
  console.log("PASS");

  console.log("9) Health + public fleet while connected");
  await withAppServer(async (server) => {
    const health = await request(server, { method: "GET", path: "/api/health" });
    assert(health.status === 200, `health ${health.status}`);
    const fleet = await request(server, { method: "GET", path: "/api/public/fleet?limit=5" });
    assert(fleet.status === 200, `fleet ${fleet.status}`);
  });
  console.log("PASS");

  console.log("5/7/8) Outage gating");
  await disconnectDB();
  const previousUri = process.env.MONGODB_URI;
  process.env.MONGODB_URI = "";
  clearSrcCache();
  delete globalThis.__aura_mongoose_cache__;

  const probe = await require("../src/config/db").probeDbHealth();
  assert(probe.ok === false, "probe should fail");

  await withAppServer(async (server) => {
    const health = await request(server, { method: "GET", path: "/api/health" });
    assert(health.status === 503, `health outage ${health.status}`);
    const fleet = await request(server, { method: "GET", path: "/api/public/fleet" });
    assert(fleet.status === 503, `fleet outage ${fleet.status}`);
    assert(fleet.ms < 5000, `fleet slow ${fleet.ms}`);
    assert(!String(fleet.body?.message || "").includes("buffering"), "buffering");
    const login = await request(server, {
      method: "POST",
      path: "/api/auth/login",
      body: { usernameOrEmail: "x", password: "y" },
      headers: { Origin: "http://localhost:3001" },
    });
    assert(login.status === 503, `login outage ${login.status}`);
  });
  console.log("PASS outage → 503");

  console.log("6) Reconnection after outage");
  process.env.MONGODB_URI = previousUri;
  clearSrcCache();
  delete globalThis.__aura_mongoose_cache__;
  const db = require("../src/config/db");
  await db.ensureDbConnected();
  assert((await db.probeDbHealth()).ok === true, "recovery failed");
  console.log("PASS");

  console.log("10) api/index boot");
  require("../api/index.js");
  console.log("PASS");

  await db.disconnectDB();
  console.log("All reliability checks passed.");
}

main().catch(async (error) => {
  console.error("FAIL", error && error.message ? error.message : error);
  try {
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
