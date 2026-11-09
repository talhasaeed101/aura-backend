const mongoose = require("mongoose");
const ApiError = require("./ApiError");

function parseObjectId(id, label = "Resource") {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${label} id.`);
  }
  return id;
}

module.exports = parseObjectId;
