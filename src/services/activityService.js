const Activity = require("../models/Activity");

async function logActivity({ kind, title, detail = "", actorId = null }) {
  try {
    await Activity.create({
      kind,
      title,
      detail,
      actorId: actorId || undefined,
      at: new Date(),
    });
  } catch (error) {
    console.error("Failed to write activity log:", error.message || error);
  }
}

async function getRecentActivity(limit = 8) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 8));
  return Activity.find({})
    .sort({ at: -1 })
    .limit(safeLimit)
    .lean();
}

module.exports = {
  logActivity,
  getRecentActivity,
};
