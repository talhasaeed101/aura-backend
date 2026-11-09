const express = require("express");
const {
  listAdminFleet,
  getFleetSummary,
  getFleetById,
  createFleet,
  updateFleet,
  updateAvailability,
  togglePublish,
  deleteFleet,
  listPublicFleet,
} = require("../controllers/fleetController");

const adminRouter = express.Router();
const publicRouter = express.Router();

adminRouter.get("/", listAdminFleet);
adminRouter.get("/summary", getFleetSummary);
adminRouter.get("/:id", getFleetById);
adminRouter.post("/", createFleet);
adminRouter.put("/:id", updateFleet);
adminRouter.patch("/:id", updateFleet);
adminRouter.patch("/:id/availability", updateAvailability);
adminRouter.patch("/:id/publish", togglePublish);
adminRouter.delete("/:id", deleteFleet);

publicRouter.get("/", listPublicFleet);

module.exports = { adminRouter, publicRouter };
