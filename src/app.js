// Local imports of app.js (and Vercel serverless entry) still pick up .env when present.
// Existing process.env values (Vercel dashboard) are never overridden.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { probeDbHealth, REQUIRED_DB_NAME } = require("./config/db");
const { isOriginAllowed } = require("./utils/corsOrigins");
const requireDatabase = require("./middleware/requireDatabase");
const requireAdminAuth = require("./middleware/requireAdminAuth");
const csrfOriginCheck = require("./middleware/csrfOrigin");
const authRoutes = require("./routes/authRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const { adminRouter: fleetAdmin, publicRouter: fleetPublic } = require("./routes/fleetRoutes");
const {
  adminRouter: servicesAdmin,
  publicRouter: servicesPublic,
} = require("./routes/servicesRoutes");
const {
  adminRouter: useCasesAdmin,
  publicRouter: useCasesPublic,
} = require("./routes/useCasesRoutes");
const {
  adminRouter: caseStudiesAdmin,
  publicRouter: caseStudiesPublic,
} = require("./routes/caseStudiesRoutes");
const {
  adminRouter: blogAdmin,
  publicRouter: blogPublic,
} = require("./routes/blogRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const {
  adminRouter: inquiriesAdmin,
  publicRouter: inquiriesPublic,
} = require("./routes/inquiriesRoutes");
const {
  adminRouter: settingsAdmin,
  publicRouter: settingsPublic,
} = require("./routes/settingsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const activityRoutes = require("./routes/activityRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Vercel (and other reverse proxies) set X-Forwarded-For; required for secure rate limits.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser / same-origin tools with no Origin header
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/api/health", async (_req, res) => {
  // Connect + ping (no secrets). 503 when aura_db is not ready.
  const db = await probeDbHealth();
  const connected =
    Boolean(db.ok) &&
    Boolean(db.connected) &&
    db.name === REQUIRED_DB_NAME;

  const payload = {
    success: connected,
    message: connected
      ? "AURA Executive API is running"
      : "AURA Executive API database is unavailable",
    database: {
      connected,
      name: db.name || null,
      readyState: db.readyState,
    },
    // Prefer Vercel deployment env so production health is not stuck on
    // NODE_ENV=development when that dashboard value is mis-set.
    environment:
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
  };

  if (!connected) {
    return res.status(503).json(payload);
  }

  return res.status(200).json(payload);
});

// All data routes require a live MongoDB connection (includes /api/auth/login).
app.use("/api", requireDatabase);

// Auth (login is public; me/logout require session)
app.use("/api/auth", authRoutes);

// Protected admin + upload surfaces
app.use("/api/uploads", requireAdminAuth, csrfOriginCheck, uploadRoutes);

app.use("/api/admin/fleet", requireAdminAuth, csrfOriginCheck, fleetAdmin);
app.use("/api/public/fleet", fleetPublic);

app.use("/api/admin/services", requireAdminAuth, csrfOriginCheck, servicesAdmin);
app.use("/api/public/services", servicesPublic);

app.use("/api/admin/use-cases", requireAdminAuth, csrfOriginCheck, useCasesAdmin);
app.use("/api/public/use-cases", useCasesPublic);

app.use(
  "/api/admin/case-studies",
  requireAdminAuth,
  csrfOriginCheck,
  caseStudiesAdmin
);
app.use("/api/public/case-studies", caseStudiesPublic);

app.use("/api/admin/blog", requireAdminAuth, csrfOriginCheck, blogAdmin);
app.use("/api/public/blog", blogPublic);

app.use("/api/admin/media", requireAdminAuth, csrfOriginCheck, mediaRoutes);

app.use(
  "/api/admin/inquiries",
  requireAdminAuth,
  csrfOriginCheck,
  inquiriesAdmin
);
app.use("/api/public/inquiries", inquiriesPublic);

app.use(
  "/api/admin/settings",
  requireAdminAuth,
  csrfOriginCheck,
  settingsAdmin
);
app.use("/api/public/settings", settingsPublic);

app.use(
  "/api/admin/dashboard",
  requireAdminAuth,
  csrfOriginCheck,
  dashboardRoutes
);
app.use(
  "/api/admin/activity",
  requireAdminAuth,
  csrfOriginCheck,
  activityRoutes
);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
