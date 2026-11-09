function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function ensureUniqueSlug(Model, baseSlug, excludeId = null) {
  let slug = slugify(baseSlug) || `item-${Date.now()}`;
  let attempt = 0;

  while (attempt < 50) {
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const existing = await Model.findOne(query).select("_id").lean();
    if (!existing) {
      return slug;
    }
    attempt += 1;
    slug = `${slugify(baseSlug)}-${attempt + 1}`;
  }

  return `${slugify(baseSlug)}-${Date.now()}`;
}

module.exports = {
  slugify,
  ensureUniqueSlug,
};
