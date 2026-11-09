/**
 * Simulates Media DB creation failure after a successful R2 upload and
 * verifies persistMediaAfterUpload deletes the exact R2 object.
 */
require("dotenv").config();

const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { connectDB, disconnectDB } = require("../src/config/db");
const { getR2Client, getR2BucketName, loadR2Config } = require("../src/config/r2");
const {
  uploadImage,
  deleteImage,
} = require("../src/services/r2StorageService");
const {
  persistMediaAfterUpload,
  findMediaByKey,
} = require("../src/services/mediaRecordService");

async function objectExists(key) {
  const client = getR2Client();
  try {
    await client.send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
      })
    );
    return true;
  } catch (error) {
    const status = error.$metadata && error.$metadata.httpStatusCode;
    const name = error.name || "";
    if (status === 404 || name === "NoSuchKey" || name === "NotFound") {
      return false;
    }
    throw error;
  }
}

async function main() {
  await connectDB();
  loadR2Config();

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );

  const result = await uploadImage({
    buffer: png,
    originalName: "orphan-test.png",
    mimeType: "image/png",
  });

  const existsAfterUpload = await objectExists(result.key);
  if (!existsAfterUpload) {
    throw new Error(`R2 object missing immediately after upload: ${result.key}`);
  }

  let thrown = null;
  try {
    await persistMediaAfterUpload(
      {
        name: "orphan-test.png",
        displayName: "orphan-test.png",
        kind: "image",
        url: result.url,
        key: result.key,
        mimeType: "image/png",
        sizeBytes: png.length,
      },
      (key) => deleteImage(key),
      async () => {
        throw new Error("Simulated Media database creation failure");
      }
    );
  } catch (error) {
    thrown = error;
  }

  if (!thrown) {
    throw new Error("Expected Media create failure was not thrown");
  }

  if (thrown.message !== "Simulated Media database creation failure") {
    throw new Error(`Unexpected error message: ${thrown.message}`);
  }

  if (thrown.r2CleanupFailed) {
    throw new Error(
      `R2 cleanup failed for key=${thrown.r2CleanupKey}: ${thrown.r2CleanupMessage}`
    );
  }

  const media = await findMediaByKey(result.key);
  if (media) {
    throw new Error(`Media record unexpectedly exists for key=${result.key}`);
  }

  const existsAfterCleanup = await objectExists(result.key);
  if (existsAfterCleanup) {
    throw new Error(`R2 object still exists after cleanup: ${result.key}`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        message: "Orphan cleanup verified",
        key: result.key,
        originalErrorPreserved: true,
        mediaRecordAbsent: true,
        r2ObjectAbsent: true,
      },
      null,
      2
    )
  );

  await disconnectDB();
}

main().catch(async (error) => {
  console.error("ORPHAN_CLEANUP_TEST_FAILED:", error.message || error);
  try {
    await disconnectDB();
  } catch (_err) {
    // ignore
  }
  process.exit(1);
});
