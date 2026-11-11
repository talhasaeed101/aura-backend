/**
 * Connection + health/login gating checks (no secrets printed).
 *
 * Usage:
 *   node scripts/test-db-connection.js
 */
require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");
const {
  connectDB,
  disconnectDB,
  ensureDbConnected,
  getDbHealth,
  parseMongoUri,
  sanitizeMongoErrorMessage,
  REQUIRED_DB_NAME,
} = require("../src/config/db");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function request(appServer, { method, path, body, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: appServer.address().port,
        method,
        path,
        headers: {
          "Content-Type": "application/json",
          ...(headers || {}),
        },
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
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on("error", reject);
    if (body !== undefined) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testUriParsing() {
  const uri = process.env.MONGODB_URI;
  assert(uri && uri.trim(), "MONGODB_URI must be set for connected tests");
  const { host, database } = parseMongoUri(uri.trim());
  assert(host.includes("aura-cluster"), "host should identify aura-cluster");
  assert(database === REQUIRED_DB_NAME, `database path must be ${REQUIRED_DB_NAME}`);
  console.log("PASS uri parse (host/db only; credentials not logged)");
}

async function testConnectReuse() {
  await disconnectDB();
  const a = await connectDB();
  const b = await connectDB();
  assert(a === b || mongoose.connection.readyState === 1, "connection reuse failed");
  const health = await ensureDbConnected();
  assert(health.connected === true, "ensureDbConnected should report connected");
  assert(health.name === REQUIRED_DB_NAME, "db name mismatch");
  console.log("PASS connect + reuse + ensureDbConnected");
}

async function testSanitize() {
  const sample =
    "failed mongodb+srv://user:secret@aura-cluster.example.net/aura_db password=super";
  const out = sanitizeMongoErrorMessage(sample);
  assert(!out.includes("secret"), "URI credentials leaked");
  assert(!out.includes("super"), "password leaked");
  assert(out.includes("[redacted-uri]"), "URI not redacted");
  console.log("PASS error sanitization");
}

async function testHealthAndLoginGating() {
  // Connected server
  const app = require("../src/app");
  await connectDB();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    const healthOk = await request(server, { method: "GET", path: "/api/health" });
    assert(healthOk.status === 200, `expected health 200, got ${healthOk.status}`);
    assert(healthOk.body?.database?.connected === true, "health should show connected");

    const loginBad = await request(server, {
      method: "POST",
      path: "/api/auth/login",
      body: { usernameOrEmail: "nobody", password: "nope" },
      headers: { Origin: "http://localhost:3001" },
    });
    // Origin may be rejected (403) or credentials invalid (401) — never buffering/500 from DB.
    assert(
      loginBad.status === 401 || loginBad.status === 403,
      `login with DB up should be 401/403, got ${loginBad.status}`
    );
    assert(
      !String(loginBad.body?.message || "").includes("buffering"),
      "login should not hit mongoose buffering"
    );
    console.log("PASS health 200 + login reaches auth (no buffering) when connected");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // Disconnected: clear connection then hit ensure path via a fresh requireDatabase check
  await disconnectDB();
  const previousUri = process.env.MONGODB_URI;
  process.env.MONGODB_URI = "";

  // Reset module cache promise by disconnect; clear URI to force ensure failure.
  try {
    await ensureDbConnected();
    throw new Error("ensureDbConnected should fail without MONGODB_URI");
  } catch (error) {
    assert(
      /MONGODB_URI is not set|MongoDB connection failed|MongoDB is not ready/i.test(
        error.message
      ),
      `unexpected ensure error: ${error.message}`
    );
    console.log("PASS ensureDbConnected fails closed when URI missing");
  } finally {
    process.env.MONGODB_URI = previousUri;
  }
}

async function main() {
  await testUriParsing();
  await testSanitize();
  await testConnectReuse();
  await testHealthAndLoginGating();
  await disconnectDB();
  console.log("All db connection checks passed.");
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
