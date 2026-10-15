const verifyAuthToken = async (req, res, next) => {
  console.log("🟢 [AUTH] Incoming request received.");

  const authHeader = req.headers["x-auth-token"];
  console.log("🔹 [AUTH] Authorization Header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ [AUTH] Authorization token missing or malformed.");
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  const token = authHeader.split("Bearer ")[1];

  // ← Replace Firebase verification with secret key check
  if (token !== process.env.secretKey) {
    console.warn("⚠️ [AUTH] Invalid secret key.");
    return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
  }

  req.user = {
    uid: token, // no Firebase uid anymore
  };

  console.log("✅ [AUTH] Token successfully verified.");
  next();
};

module.exports = verifyAuthToken;