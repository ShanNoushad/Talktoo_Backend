const mongoose = require("mongoose");

mongoose.connect(process.env.MongoDb_Connection_String);

const db = mongoose.connection;

db.on("connected", () => {
  console.log("✅ MongoDB connected successfully");
});

db.on("error", (err) => {
  console.log("❌ MongoDB connection error:", err);
});

module.exports = db;