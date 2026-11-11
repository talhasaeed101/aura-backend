const mongoose = require("mongoose");

const REQUIRED_DB_NAME = "aura_db";
const SERVER_SELECTION_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 45_000;
/** One retry only (2 attempts total) for transient Atlas/network blips. */
const CONNECT_RETRY_LIMIT = 1;
const CONNECT_RETRY_DELAY_MS = 300;

/**
 * Cross-invocation cache for Vercel/serverless warm instances.
 * Avoids opening a new MongoClient on every request.
 */
const globalKey = "__aura_mongoose_cache__";
const cache = globalThis[globalKey] || {
  promise: null,
  listenersBound: false,
};
globalThis[globalKey] = cache;

// Fail fast if a query runs without an established connection (no 10s buffer wait).
mongoose.set("bufferCommands", false);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isServerlessRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

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

  if (normalized.startsWith("cluster0.") || normalized === "cluster0") {
    throw new Error(
      "Refusing to connect: hostname looks like a non-AURA Cluster0. Use the dedicated AURA aura-cluster hostname."
    );
  }

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

function bindConnectionListeners() {
  if (cache.listenersBound) return;
  cache.listenersBound = true;

  mongoose.connection.on("disconnected", () => {
    // Allow the next request to open a fresh connection.
    cache.promise = null;
    console.warn("MongoDB disconnected.");
  });

  mongoose.connection.on("error", (error) => {
    const safe = sanitizeMongoErrorMessage(
      error && error.message ? error.message : "Unknown error"
    );
    console.error(`MongoDB connection error: ${safe}`);
  });
}

function mongooseConnectOptions() {
  return {
    dbName: REQUIRED_DB_NAME,
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: CONNECT_TIMEOUT_MS,
    socketTimeoutMS: SOCKET_TIMEOUT_MS,
    // Serverless: keep pools tiny so many warm instances do not exhaust Atlas.
    maxPoolSize: isServerlessRuntime() ? 2 : 10,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    retryWrites: true,
  };
}

async function openMongoConnection() {
  const uri = getMongoUri();
  const { host, database } = parseMongoUri(uri);
  assertAuraClusterHost(host);
  assertAuraDatabaseName(database, null);
  bindConnectionListeners();

  try {
    const connection = await mongoose.connect(uri, mongooseConnectOptions());
    const activeDbName = connection.connection.name;
    assertAuraDatabaseName(database, activeDbName);

    if (activeDbName !== REQUIRED_DB_NAME) {
      await mongoose.connection.close();
      cache.promise = null;
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
}

/**
 * Connect (or reuse) the shared Mongoose connection.
 * Concurrent callers share one in-flight promise.
 * At most one automatic retry on transient failure.
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = (async () => {
    let lastError;
    for (let attempt = 0; attempt <= CONNECT_RETRY_LIMIT; attempt++) {
      try {
        return await openMongoConnection();
      } catch (error) {
        lastError = error;
        cache.promise = null;
        if (attempt < CONNECT_RETRY_LIMIT) {
          await sleep(CONNECT_RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }
    throw lastError;
  })().catch((error) => {
    cache.promise = null;
    throw error;
  });

  return cache.promise;
}

async function pingDb() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error("MongoDB is not ready for ping.");
  }
  await mongoose.connection.db.admin().command({ ping: 1 });
}

/**
 * Reset a stale/broken connection once so the next connect can succeed.
 * Does not loop.
 */
async function resetConnection() {
  cache.promise = null;
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close();
    } catch {
      /* ignore close races during serverless freeze/thaw */
    }
  }
}

/**
 * Ensure MongoDB is connected, bound to aura_db, and responsive to ping.
 * On a stale socket: reset once and reconnect once — no uncontrolled loops.
 */
async function ensureDbConnected() {
  await connectDB();

  try {
    await pingDb();
  } catch {
    await resetConnection();
    await connectDB();
    await pingDb();
  }

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

/**
 * Health-oriented readiness probe. Never throws; never leaks secrets.
 */
async function probeDbHealth() {
  try {
    await ensureDbConnected();
    const health = getDbHealth();
    return {
      ok: Boolean(health.connected) && health.name === REQUIRED_DB_NAME,
      ...health,
    };
  } catch {
    const health = getDbHealth();
    return {
      ok: false,
      connected: false,
      name: health.name,
      readyState: health.readyState,
    };
  }
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
  probeDbHealth,
  pingDb,
  parseMongoUri,
  sanitizeMongoErrorMessage,
  REQUIRED_DB_NAME,
};
