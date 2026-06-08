const mongoose = require("mongoose");

const paymentOptionSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    image: { type: String, default: "" },
    details: { type: Array, default: [] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentOptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PaymentOption", paymentOptionSchema);
