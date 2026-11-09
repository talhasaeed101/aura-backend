#!/usr/bin/env node
/**
 * Bootstrap the single AURA admin account from environment variables.
 *
 * Usage (from backend/):
 *   node scripts/create-admin.js
 *
 * Required env:
 *   MONGODB_URI, ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD
 *
 * Safe to re-run: if an admin already exists, this script exits without
 * modifying the existing password or credentials.
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB, disconnectDB } = require("../src/config/db");
const Admin = require("../src/models/Admin");
const { BCRYPT_ROUNDS } = require("../src/controllers/authController");

function fail(message) {
  console.error(`create-admin: ${message}`);
  process.exitCode = 1;
}

function isStrongPassword(password) {
  if (password.length < 10) return false;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

async function main() {
  const username = String(process.env.ADMIN_USERNAME || "")
    .trim()
    .toLowerCase();
  const email = String(process.env.ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!username || username.length < 3) {
    fail("ADMIN_USERNAME is required (min 3 characters).");
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("ADMIN_EMAIL is required and must be a valid email.");
    return;
  }
  if (!password) {
    fail("ADMIN_PASSWORD is required.");
    return;
  }
  if (!isStrongPassword(password)) {
    fail(
      "ADMIN_PASSWORD is too weak (min 10 characters, include letters and numbers)."
    );
    return;
  }

  await connectDB();

  const existingCount = await Admin.countDocuments({});
  if (existingCount > 0) {
    const existing = await Admin.findOne({}).select("username email");
    console.log(
      `create-admin: admin already exists (username=${existing.username}). No changes made.`
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const admin = await Admin.create({
    username,
    email,
    passwordHash,
    role: "admin",
  });

  console.log(
    `create-admin: created admin account id=${admin._id} username=${admin.username} email=${admin.email}`
  );
}

main()
  .catch((error) => {
    const message = error && error.message ? error.message : "Unknown error";
    fail(message.replace(/mongodb(?:\+srv)?:\/\/[^\s'"]+/gi, "[redacted-uri]"));
  })
  .finally(async () => {
    try {
      await disconnectDB();
    } catch {
      /* ignore */
    }
  });
