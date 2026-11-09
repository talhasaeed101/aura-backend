function toClientDoc(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  obj.id = String(obj._id);
  delete obj._id;
  delete obj.__v;
  return obj;
}

function toClientDocs(docs) {
  return (docs || []).map(toClientDoc);
}

module.exports = {
  toClientDoc,
  toClientDocs,
};
