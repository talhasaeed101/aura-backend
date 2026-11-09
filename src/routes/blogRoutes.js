const express = require("express");
const ctrl = require("../controllers/blogController");

const adminRouter = express.Router();
const publicRouter = express.Router();

adminRouter.get("/", ctrl.listAdmin);
adminRouter.get("/summary", ctrl.getSummary);
adminRouter.get("/:id", ctrl.getById);
adminRouter.post("/", ctrl.create);
adminRouter.put("/:id", ctrl.update);
adminRouter.patch("/:id", ctrl.update);
adminRouter.patch("/:id/publish", ctrl.togglePublish);
adminRouter.patch("/:id/featured", ctrl.toggleFeatured);
adminRouter.post("/:id/duplicate", ctrl.duplicate);
adminRouter.delete("/:id", ctrl.remove);

publicRouter.get("/", ctrl.listPublic);
publicRouter.get("/:slug", ctrl.getPublicBySlug);

module.exports = { adminRouter, publicRouter };
