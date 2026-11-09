const { S3Client } = require("@aws-sdk/client-s3");

const REQUIRED_BUCKET = "aura-transport-images";

const REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
  "R2_PUBLIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];

let client = null;
let config = null;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function assertAuraBucket(bucketName) {
  if (bucketName !== REQUIRED_BUCKET) {
    throw new Error(
      `Refusing to use R2 bucket "${bucketName}". Expected dedicated AURA bucket "${REQUIRED_BUCKET}".`
    );
  }
}

function loadR2Config() {
  if (config) {
    return config;
  }

  const missing = REQUIRED_ENV.filter(
    (name) => !process.env[name] || !String(process.env[name]).trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `R2 configuration incomplete. Missing: ${missing.join(", ")}`
    );
  }

  const bucketName = getRequiredEnv("R2_BUCKET_NAME");
  assertAuraBucket(bucketName);

  const endpoint = getRequiredEnv("R2_ENDPOINT").replace(/\/$/, "");
  const publicUrl = getRequiredEnv("R2_PUBLIC_URL").replace(/\/$/, "");
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");

  // Soft isolation: endpoint should target Cloudflare R2 for this account.
  if (!endpoint.includes("r2.cloudflarestorage.com")) {
    throw new Error(
      "R2_ENDPOINT must be a Cloudflare R2 S3 API endpoint (*.r2.cloudflarestorage.com)."
    );
  }

  if (accountId && !endpoint.includes(accountId)) {
    throw new Error(
      "R2_ENDPOINT does not match R2_ACCOUNT_ID. Check AURA R2 configuration."
    );
  }

  config = {
    accountId,
    bucketName,
    endpoint,
    publicUrl,
    accessKeyId,
    secretAccessKey,
  };

  return config;
}

function getR2Client() {
  if (client) {
    return client;
  }

  const cfg = loadR2Config();

  client = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  console.log(
    `R2 client initialized — bucket: ${cfg.bucketName}, endpoint host configured`
  );

  return client;
}

function getR2PublicUrl(objectKey) {
  const cfg = loadR2Config();
  const key = String(objectKey || "").replace(/^\/+/, "");
  return `${cfg.publicUrl}/${key}`;
}

function getR2BucketName() {
  return loadR2Config().bucketName;
}

module.exports = {
  REQUIRED_BUCKET,
  loadR2Config,
  getR2Client,
  getR2PublicUrl,
  getR2BucketName,
};
