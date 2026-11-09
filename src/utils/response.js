function sendSuccess(res, { status = 200, message = "Operation successful", data = null } = {}) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

function sendError(res, { status = 500, message = "Something went wrong", errors = [] } = {}) {
  return res.status(status).json({
    success: false,
    message,
    errors,
  });
}

module.exports = {
  sendSuccess,
  sendError,
};
