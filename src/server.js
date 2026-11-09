require("dotenv").config();

const app = require("./app");
const { connectDB, disconnectDB } = require("./config/db");
const { getR2Client, loadR2Config } = require("./config/r2");

const PORT = process.env.PORT || 5000;

let server;

async function start() {
  try {
    await connectDB();

    // Validate R2 env and initialize S3-compatible client before serving traffic.
    loadR2Config();
    getR2Client();

    server = app.listen(PORT, () => {
      console.log(`AURA API running on port ${PORT}`);
    });
  } catch (error) {
    const message =
      error && error.message
        ? error.message
        : "Failed to start AURA API.";
    console.error(`Startup aborted: ${message}`);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  const closeServer = () =>
    new Promise((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => resolve());
    });

  try {
    await closeServer();
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown.");
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

start();
