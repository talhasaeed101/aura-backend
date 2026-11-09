const mongoose = require("mongoose");

const REQUIRED_DB_NAME = "aura_db";
const SERVER_SELECTION_TIMEOUT_MS = 10000;

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

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || !String(uri).trim()) {
    throw new Error(
      "MONGODB_URI is not set. Add the dedicated AURA Atlas connection string to backend/.env."
    );
  }

  const { host, database } = parseMongoUri(uri.trim());
  assertAuraClusterHost(host);
  assertAuraDatabaseName(database, null);

  try {
    const connection = await mongoose.connect(uri.trim(), {
      dbName: REQUIRED_DB_NAME,
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
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

    return connection;
  } catch (error) {
    const safeMessage = error && error.message ? error.message : "Unknown error";
    // Avoid leaking URI/credentials that drivers sometimes embed in messages.
    const sanitized = safeMessage
      .replace(/mongodb(?:\+srv)?:\/\/[^\s'"]+/gi, "[redacted-uri]")
      .replace(/pass(word)?[=:]\s*\S+/gi, "password=[redacted]");

    throw new Error(`MongoDB connection failed: ${sanitized}`);
  }
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
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  getDbHealth,
  REQUIRED_DB_NAME,
};
