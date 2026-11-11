const mongoose = require("mongoose");

const REQUIRED_DB_NAME = "aura_db";
const SERVER_SELECTION_TIMEOUT_MS = 10000;

/**
 * Cross-invocation cache for Vercel/serverless warm instances.
 * Avoids opening a new MongoClient on every cold-adjacent request.
 */
const globalKey = "__aura_mongoose_cache__";
const cache = globalThis[globalKey] || { promise: null };
globalThis[globalKey] = cache;

// Fail fast if a query runs without an established connection (no 10s buffer wait).
mongoose.set("bufferCommands", false);

/**
 * Parse MongoDB URI without logging credentials.
 * Returns { host, database } or throws on invalid URI shape.
 */
function parseMongoUri(uri) {
  const match = uri.match(
    /^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/?]+)(?:\/([^?]*))?/i
  );

  if (!match) {
    throw new Error("MONGODB_URI is not a valid MongoDB connection string.");
  }

  const host = match[1];
  const database = (match[2] || "").trim();

  return { host, database };
}

function assertAuraClusterHost(host) {
  const normalized = String(host || "").toLowerCase();

  if (!normalized) {
    throw new Error("MONGODB_URI is missing a cluster hostname.");
  }

  // Reject known non-AURA / shared legacy cluster names.
  if (normalized.startsWith("cluster0.") || normalized === "cluster0") {
    throw new Error(
      "Refusing to connect: hostname looks like a non-AURA Cluster0. Use the dedicated AURA aura-cluster hostname."
    );
  }

  // Dedicated AURA cluster should identify as aura (e.g. aura-cluster.*.mongodb.net).
  const identifiesAura =
    normalized.includes("aura-cluster") ||
    normalized.startsWith("aura.") ||
    /(^|\.)aura[-.]/.test(normalized);

  if (!identifiesAura) {
    throw new Error(
      "Refusing to connect: cluster hostname does not clearly identify the dedicated AURA cluster (expected aura-cluster). Update MONGODB_URI and retry."
    );
  }
}

function assertAuraDatabaseName(databaseFromUri, databaseFromConnection) {
  const configured = databaseFromUri || databaseFromConnection;

  if (!configured) {
    throw new Error(
      'MONGODB_URI must explicitly include the database name "aura_db" in the path.'
    );
  }

  if (configured !== REQUIRED_DB_NAME) {
    throw new Error(
      `Refusing to connect: database name must be exactly "${REQUIRED_DB_NAME}", got "${configured}".`
    );
  }
}

function sanitizeMongoErrorMessage(message) {
  return String(message || "Unknown error")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'"]+/gi, "[redacted-uri]")
    .replace(/pass(word)?[=:]\s*\S+/gi, "password=[redacted]");
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !String(uri).trim()) {
    throw new Error(
      "MONGODB_URI is not set. Configure the dedicated AURA Atlas connection string in the runtime environment."
    );
  }
  return uri.trim();
}

/**
 * Connect (or reuse) the shared Mongoose connection.
 * Safe for local long-running servers and Vercel serverless invocations.
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = (async () => {
    const uri = getMongoUri();
    const { host, database } = parseMongoUri(uri);
    assertAuraClusterHost(host);
    assertAuraDatabaseName(database, null);

    try {
      const connection = await mongoose.connect(uri, {
        dbName: REQUIRED_DB_NAME,
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
        maxPoolSize: 10,
        // Keep serverless functions from holding idle sockets forever.
        maxIdleTimeMS: 60_000,
      });

      const activeDbName = connection.connection.name;
      assertAuraDatabaseName(database, activeDbName);

      if (activeDbName !== REQUIRED_DB_NAME) {
        await mongoose.connection.close();
        throw new Error(
          `Connected database was "${activeDbName}", expected "${REQUIRED_DB_NAME}". Connection closed.`
        );
      }

      console.log(
        `MongoDB connected — host: ${host}, database: ${REQUIRED_DB_NAME}`
      );

      return connection.connection;
    } catch (error) {
      const safeMessage = sanitizeMongoErrorMessage(
        error && error.message ? error.message : "Unknown error"
      );
      throw new Error(`MongoDB connection failed: ${safeMessage}`);
    }
  })().catch((error) => {
    // Allow the next request to retry after a failed attempt.
    cache.promise = null;
    throw error;
  });

  return cache.promise;
}

/**
 * Ensure MongoDB is connected and bound to aura_db.
 * Throws a sanitized Error when unavailable.
 */
async function ensureDbConnected() {
  await connectDB();
  const health = getDbHealth();
  if (!health.connected || health.name !== REQUIRED_DB_NAME) {
    throw new Error(
      `MongoDB is not ready (readyState=${health.readyState}).`
    );
  }
  return health;
}

function getDbHealth() {
  const state = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const connected = state === 1;
  const name = mongoose.connection.name || null;

  return {
    connected,
    name: connected ? name : name || null,
    readyState: state,
  };
}

async function disconnectDB() {
  cache.promise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

module.exports = {
  connectDB,
  ensureDbConnected,
  disconnectDB,
  getDbHealth,
  parseMongoUri,
  sanitizeMongoErrorMessage,
  REQUIRED_DB_NAME,
};
