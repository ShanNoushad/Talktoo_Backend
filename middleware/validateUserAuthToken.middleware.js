const User = require("../models/user.model");

const validateUserAuthToken = async (req, res, next) => {
  console.log("🔹 [AUTH] Received authentication request.");

  const authHeader = req.headers["x-auth-token"];
  const userUid = req.headers["x-auth-uid"]; // now MongoDB _id

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ [AUTH] Missing or invalid authorization header.");
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  if (!userUid) {
    console.warn("⚠️ [AUTH] Missing User UID.");
    return res.status(401).json({ status: false, message: "User UID required for authentication." });
  }

  const token = authHeader.split("Bearer ")[1];

  // ← Replace Firebase verification with secret key check
  if (token !== process.env.secretKey) {
    console.warn("⚠️ [AUTH] Invalid secret key.");
    return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
  }

  try {
    // ← Find user by MongoDB _id instead of firebaseId
    const mongoUser = await User.findById(userUid).select("_id isBlock").lean();

    if (!mongoUser) {
      console.warn(`⚠️ [AUTH] No user found for ID: ${userUid}`);
      return res.status(200).json({ status: false, message: "User not found in the database." });
    }

    if (mongoUser.isBlock) {
      console.warn(`⚠️ [AUTH] User is blocked: ${userUid}`);
      return res.status(403).json({ status: false, message: "🚷 User are blocked by the admin." });
    }

    req.user = {
      userId: mongoUser._id,
    };

    console.log(`✅ [AUTH] Authentication successful. MongoID: ${mongoUser._id}`);
    next();
  } catch (error) {
    console.error("❌ [AUTH ERROR]:", error.message);
    return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
  }
};

module.exports = validateUserAuthToken;