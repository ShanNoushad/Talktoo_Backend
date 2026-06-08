const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ["User", "Listener"], required: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

faqSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Faq", faqSchema);
