const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

if (!privateKey) {
  console.error("❌ Firebase private key not found in global setting.");
  process.exit(1); // Exit process to prevent running without credentials
}

//import model
const User = require("../models/user.model");

const validateUserAuthToken = async (req, res, next) => {
  console.log("🔹 [AUTH] Received authentication request.");

  const authHeader = req.headers["x-auth-token"] || req.headers["x-auth-token"];
  const userUid = req.headers["x-auth-uid"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ [AUTH] Missing or invalid authorization header.");
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  if (!userUid) {
    console.warn("⚠️ [AUTH] Missing API key or User UID.");
    return res.status(401).json({ status: false, message: "User UID required for authentication." });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    console.log("🔹 [AUTH] Verifying Firebase token...");

    const [decodedToken, mongoUser] = await Promise.all([admin.auth().verifyIdToken(token), User.findOne({ firebaseId: userUid }).select("_id isBlock").lean()]);

    if (!decodedToken) {
      console.warn("⚠️ [AUTH] Token verification failed.");
      return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
    }

    if (!mongoUser) {
      console.warn(`⚠️ [AUTH] No user found in MongoDB for Firebase UID: ${decodedToken.uid}`);
      return res.status(200).json({ status: false, message: "User not found in the database." });
    }

    if (mongoUser.isBlock) {
      console.warn(`⚠️ [AUTH] User is blocked by admin: ${decodedToken.uid}`);
      return res.status(403).json({ status: false, message: "🚷 User are blocked by the admin." });
    }

    req.user = {
      uid: decodedToken.uid,
      userId: mongoUser._id,
    };

    console.log(`✅ [AUTH] User authentication successful. MongoID: ${mongoUser._id}`);
    next();
  } catch (error) {
    console.error("❌ [AUTH ERROR] Token verification failed:", error.message);

    return res.status(401).json({
      status: false,
      message: error.code === "auth/id-token-expired" ? "Token expired. Please reauthenticate." : "Invalid token. Authorization failed.",
    });
  }
};

module.exports = validateUserAuthToken;
