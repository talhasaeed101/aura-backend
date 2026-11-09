const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { getDbHealth, REQUIRED_DB_NAME } = require("./config/db");
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

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim())
      : true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  const db = getDbHealth();
  const connected = Boolean(db.connected) && db.name === REQUIRED_DB_NAME;

  const payload = {
    success: connected,
    message: connected
      ? "AURA Executive API is running"
      : "AURA Executive API database is unavailable",
    database: {
      connected,
      name: db.name || null,
    },
    environment: process.env.NODE_ENV || "development",
  };

  if (!connected) {
    return res.status(503).json(payload);
  }

  return res.status(200).json(payload);
});

app.use("/api/uploads", uploadRoutes);

app.use("/api/admin/fleet", fleetAdmin);
app.use("/api/public/fleet", fleetPublic);

app.use("/api/admin/services", servicesAdmin);
app.use("/api/public/services", servicesPublic);

app.use("/api/admin/use-cases", useCasesAdmin);
app.use("/api/public/use-cases", useCasesPublic);

app.use("/api/admin/case-studies", caseStudiesAdmin);
app.use("/api/public/case-studies", caseStudiesPublic);

app.use("/api/admin/blog", blogAdmin);
app.use("/api/public/blog", blogPublic);

app.use("/api/admin/media", mediaRoutes);

app.use("/api/admin/inquiries", inquiriesAdmin);
app.use("/api/public/inquiries", inquiriesPublic);

app.use("/api/admin/settings", settingsAdmin);
app.use("/api/public/settings", settingsPublic);

app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/activity", activityRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
