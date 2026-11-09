const { randomUUID } = require("crypto");
const Settings = require("../models/Settings");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { toClientDoc } = require("../utils/document");
const { sendSuccess } = require("../utils/response");
const { logActivity } = require("../services/activityService");

const SETTINGS_LIMITS = {
  companyName: 80,
  shortDescription: 320,
  phone: 40,
  email: 120,
  address: 240,
  officeHours: 120,
  socialUrl: 240,
  metaTitle: 60,
  metaDescription: 160,
  ctaHeading: 120,
  ctaDescription: 320,
  ctaLabel: 48,
  ctaUrl: 200,
  mediaRef: 200,
};

const TABLE_PAGE_SIZES = [5, 6, 8, 10, 12];
const DATE_FORMATS = ["dd_mmm_yyyy", "yyyy_mm_dd", "mmm_dd_yyyy"];
const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "x",
];

async function getOrCreateSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}

function assertMax(value, max, field) {
  if (typeof value === "string" && value.length > max) {
    throw new ApiError(400, `${field} must be at most ${max} characters.`);
  }
}

function validateCompany(company = {}) {
  assertMax(company.companyName, SETTINGS_LIMITS.companyName, "companyName");
  assertMax(
    company.shortDescription,
    SETTINGS_LIMITS.shortDescription,
    "shortDescription"
  );
  assertMax(company.logoRef, SETTINGS_LIMITS.mediaRef, "logoRef");
  assertMax(company.faviconRef, SETTINGS_LIMITS.mediaRef, "faviconRef");
}

function validateContact(contact = {}) {
  assertMax(contact.phone, SETTINGS_LIMITS.phone, "phone");
  assertMax(contact.email, SETTINGS_LIMITS.email, "email");
  assertMax(contact.address, SETTINGS_LIMITS.address, "address");
  assertMax(contact.whatsapp, SETTINGS_LIMITS.phone, "whatsapp");
  assertMax(contact.officeHours, SETTINGS_LIMITS.officeHours, "officeHours");
}

function validateSocialLinks(links) {
  if (!Array.isArray(links)) {
    throw new ApiError(400, "socialLinks must be an array.");
  }
  for (const link of links) {
    if (!SOCIAL_PLATFORMS.includes(link.platform)) {
      throw new ApiError(400, `Invalid social platform: ${link.platform}`);
    }
    assertMax(link.url, SETTINGS_LIMITS.socialUrl, "social url");
  }
}

function validateSeo(seo = {}) {
  assertMax(seo.metaTitle, SETTINGS_LIMITS.metaTitle, "metaTitle");
  assertMax(
    seo.metaDescription,
    SETTINGS_LIMITS.metaDescription,
    "metaDescription"
  );
  assertMax(seo.ogImageRef, SETTINGS_LIMITS.mediaRef, "ogImageRef");
}

function validateSharedCta(cta = {}) {
  assertMax(cta.heading, SETTINGS_LIMITS.ctaHeading, "heading");
  assertMax(cta.description, SETTINGS_LIMITS.ctaDescription, "description");
  assertMax(cta.buttonLabel, SETTINGS_LIMITS.ctaLabel, "buttonLabel");
  assertMax(cta.buttonUrl, SETTINGS_LIMITS.ctaUrl, "buttonUrl");
}

function validatePreferences(preferences = {}) {
  if (
    preferences.tablePageSize !== undefined &&
    !TABLE_PAGE_SIZES.includes(Number(preferences.tablePageSize))
  ) {
    throw new ApiError(400, "Invalid tablePageSize.");
  }
  if (
    preferences.dateDisplayFormat !== undefined &&
    !DATE_FORMATS.includes(preferences.dateDisplayFormat)
  ) {
    throw new ApiError(400, "Invalid dateDisplayFormat.");
  }
}

function normalizeSocialLinks(links = []) {
  return links.map((link) => ({
    id: link.id || randomUUID(),
    platform: link.platform,
    url: String(link.url || "").trim(),
  }));
}

function publicSettingsView(settings) {
  const doc = toClientDoc(settings);
  return {
    company: doc.company,
    contact: doc.contact,
    socialLinks: doc.socialLinks,
    seo: doc.seo,
    sharedCta: doc.sharedCta,
    updatedAt: doc.updatedAt,
  };
}

const getAdminSettings = asyncHandler(async (_req, res) => {
  const settings = await getOrCreateSettings();
  return sendSuccess(res, {
    message: "Settings retrieved.",
    data: toClientDoc(settings),
  });
});

const putAdminSettings = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (body.company) validateCompany(body.company);
  if (body.contact) validateContact(body.contact);
  if (body.socialLinks) validateSocialLinks(body.socialLinks);
  if (body.seo) validateSeo(body.seo);
  if (body.sharedCta) validateSharedCta(body.sharedCta);
  if (body.preferences) validatePreferences(body.preferences);

  const settings = await getOrCreateSettings();

  const asPlain = (value) =>
    value && typeof value.toObject === "function" ? value.toObject() : { ...(value || {}) };

  if (body.company) settings.company = { ...asPlain(settings.company), ...body.company };
  if (body.contact) settings.contact = { ...asPlain(settings.contact), ...body.contact };
  if (body.socialLinks) settings.socialLinks = normalizeSocialLinks(body.socialLinks);
  if (body.seo) settings.seo = { ...asPlain(settings.seo), ...body.seo };
  if (body.sharedCta) {
    settings.sharedCta = { ...asPlain(settings.sharedCta), ...body.sharedCta };
  }
  if (body.preferences) {
    settings.preferences = {
      ...asPlain(settings.preferences),
      ...body.preferences,
    };
  }

  await settings.save();

  await logActivity({
    kind: "settings",
    title: "Settings updated",
    detail: "Full settings save",
  });

  return sendSuccess(res, {
    message: "Settings saved.",
    data: toClientDoc(settings),
  });
});

function patchSection(sectionName, validator) {
  return asyncHandler(async (req, res) => {
    const body = req.body || {};
    validator(body);

    const settings = await getOrCreateSettings();

    const asPlain = (value) =>
      value && typeof value.toObject === "function" ? value.toObject() : { ...(value || {}) };

    if (sectionName === "socialLinks") {
      settings.socialLinks = normalizeSocialLinks(body.socialLinks || body);
    } else if (sectionName === "sharedCta") {
      settings.sharedCta = { ...asPlain(settings.sharedCta), ...body };
    } else {
      settings[sectionName] = {
        ...asPlain(settings[sectionName]),
        ...body,
      };
    }

    await settings.save();

    await logActivity({
      kind: "settings",
      title: `Settings ${sectionName} updated`,
      detail: sectionName,
    });

    return sendSuccess(res, {
      message: `Settings ${sectionName} updated.`,
      data: toClientDoc(settings),
    });
  });
}

const patchCompany = patchSection("company", validateCompany);
const patchContact = patchSection("contact", validateContact);
const patchSeo = patchSection("seo", validateSeo);
const patchSharedCta = patchSection("sharedCta", validateSharedCta);
const patchPreferences = patchSection("preferences", validatePreferences);

const patchSocial = asyncHandler(async (req, res) => {
  const links = Array.isArray(req.body)
    ? req.body
    : req.body?.socialLinks || [];
  validateSocialLinks(links);

  const settings = await getOrCreateSettings();
  settings.socialLinks = normalizeSocialLinks(links);
  await settings.save();

  await logActivity({
    kind: "settings",
    title: "Settings social links updated",
    detail: `${settings.socialLinks.length} link(s)`,
  });

  return sendSuccess(res, {
    message: "Settings social links updated.",
    data: toClientDoc(settings),
  });
});

const getPublicSettings = asyncHandler(async (_req, res) => {
  const settings = await getOrCreateSettings();
  return sendSuccess(res, {
    message: "Public settings retrieved.",
    data: publicSettingsView(settings),
  });
});

module.exports = {
  getAdminSettings,
  putAdminSettings,
  patchCompany,
  patchContact,
  patchSocial,
  patchSeo,
  patchSharedCta,
  patchPreferences,
  getPublicSettings,
};
