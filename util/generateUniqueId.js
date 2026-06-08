const User = require("../models/user.model");
// const Listener = require("../models/listener.model");

const crypto = require("crypto");

const generateUniqueId = async () => {
  const length = 8;
  let uniqueId = "";
  let isUnique = false;

  while (!isUnique) {
    let idBody = "";
    for (let i = 0; i < length; i++) {
      idBody += crypto.randomInt(0, 10).toString(); //secure random digit 0–9
    }

    uniqueId = idBody;

    const [user, listener] = await Promise.all([
      User.findOne({ uniqueId }).select("_id"),
      // Listener.findOne({ uniqueId }).select("_id")
    ]);

    isUnique = !(user || listener);
  }

  return uniqueId;
};

module.exports = generateUniqueId;
