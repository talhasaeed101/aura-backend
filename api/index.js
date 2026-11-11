/**
 * Vercel serverless entry.
 * Exports the Express app so each invocation can connect via requireDatabase /
 * connectDB reuse — server.js listen() is for local/long-running only.
 */
const app = require("../src/app");

module.exports = app;
