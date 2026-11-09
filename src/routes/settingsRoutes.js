const express = require("express");
const {
  getAdminSettings,
  putAdminSettings,
  patchCompany,
  patchContact,
  patchSocial,
  patchSeo,
  patchSharedCta,
  patchPreferences,
  getPublicSettings,
} = require("../controllers/settingsController");

const adminRouter = express.Router();
const publicRouter = express.Router();

adminRouter.get("/", getAdminSettings);
adminRouter.put("/", putAdminSettings);
adminRouter.patch("/company", patchCompany);
adminRouter.patch("/contact", patchContact);
adminRouter.patch("/social", patchSocial);
adminRouter.patch("/seo", patchSeo);
adminRouter.patch("/shared-cta", patchSharedCta);
adminRouter.patch("/preferences", patchPreferences);

publicRouter.get("/", getPublicSettings);

module.exports = { adminRouter, publicRouter };
