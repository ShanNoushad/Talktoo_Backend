const mongoose = require("mongoose");

const { WITHDRAWAL_STATUS } = require("../types/constant");

const withdrawalRecordSchema = new mongoose.Schema(
  {
    listenerId: { type: mongoose.Schema.Types.ObjectId, ref: "Listener", default: null },
    uniqueId: { type: String, default: "" },
    status: { type: Number, default: 1, enum: WITHDRAWAL_STATUS },
    coin: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    paymentGateway: { type: String, default: "" },
    paymentDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    reason: { type: String, default: "" },
    requestDate: { type: String, default: "" },
    acceptOrDeclineDate: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

withdrawalRecordSchema.index({ status: 1, listenerId: 1 });
withdrawalRecordSchema.index({ createdAt: -1 });

module.exports = mongoose.model("WithdrawalRecord", withdrawalRecordSchema);
