const Media = require("../models/Media");
const formatBytes = require("../utils/formatBytes");

async function createMediaRecord({
  name,
  displayName,
  kind,
  url,
  key,
  alt = "",
  mimeType,
  sizeBytes,
  width = null,
  height = null,
  usageLabel = "",
  usedIn = [],
}) {
  return Media.create({
    name,
    displayName: displayName || name,
    kind,
    url,
    key,
    alt,
    mimeType,
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    width,
    height,
    usageLabel,
    usedIn,
    uploadedAt: new Date(),
  });
}

/**
 * Persist a Media row after a successful R2 upload.
 * If Media creation fails, attempt to delete the exact R2 object.
 * Cleanup failures are logged with the object key and attached to the
 * original DB error without replacing it.
 */
async function persistMediaAfterUpload(
  payload,
  deleteR2Object,
  createFn = createMediaRecord
) {
  try {
    return await createFn(payload);
  } catch (error) {
    const key = payload && payload.key ? String(payload.key) : "";

    if (key && typeof deleteR2Object === "function") {
      try {
        await deleteR2Object(key);
      } catch (cleanupError) {
        const cleanupMessage =
          cleanupError && cleanupError.message
            ? cleanupError.message
            : "Unknown R2 cleanup error";

        console.error(
          `Failed to clean up R2 object after Media create failure. objectKey=${key} error=${cleanupMessage}`
        );

        error.r2CleanupFailed = true;
        error.r2CleanupKey = key;
        error.r2CleanupMessage = cleanupMessage;
      }
    }

    throw error;
  }
}

async function findMediaByKey(key) {
  return Media.findOne({ key });
}

async function deleteMediaByKey(key) {
  return Media.findOneAndDelete({ key });
}

module.exports = {
  createMediaRecord,
  persistMediaAfterUpload,
  findMediaByKey,
  deleteMediaByKey,
};
