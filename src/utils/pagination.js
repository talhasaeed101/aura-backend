function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  let limit = Number.parseInt(String(query.limit || String(defaultLimit)), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(maxLimit, limit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function paginatedResult({ items, total, page, limit }) {
  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

module.exports = {
  parsePagination,
  paginatedResult,
};
