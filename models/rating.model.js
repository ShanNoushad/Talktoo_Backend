const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    listenerId: { type: mongoose.Schema.Types.ObjectId, ref: "Listener", default: null },
    review: { type: String, default: "" },
    rating: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ratingSchema.index({ listenerId: 1 });

module.exports = mongoose.model("Rating", ratingSchema);
