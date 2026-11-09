const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { getRecentActivity } = require("../services/activityService");

const listActivity = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 8;
  const items = await getRecentActivity(limit);

  return sendSuccess(res, {
    message: "Activity retrieved.",
    data: items.map((item) => ({
      id: String(item._id),
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      at: item.at,
      actorId: item.actorId || null,
    })),
  });
});

module.exports = {
  listActivity,
};
