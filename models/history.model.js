const { HISTORY_TYPE, WITHDRAWAL_STATUS } = require("../types/constant");

const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    uniqueId: { type: String, unique: true, trim: true, default: "" },
    type: { type: Number, enum: HISTORY_TYPE },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    listenerId: { type: mongoose.Schema.Types.ObjectId, ref: "Listener", default: null },

    callerRole: { type: String, default: "" }, //user or listener
    callType: { type: String, default: "" }, //audio or video
    isRandom: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    callConnect: { type: Boolean, default: false },
    callStartTime: { type: String, default: "" },
    callEndTime: { type: String, default: "" },
    duration: { type: String, default: "00:00:00" },

    userCoin: { type: Number, default: 0 },
    listenerCoin: { type: Number, default: 0 },
    adminCoin: { type: Number, default: 0 },

    price: { type: Number, default: 0 },
    payoutStatus: { type: Number, default: 0, enum: WITHDRAWAL_STATUS },
    reason: { type: String, default: "" },
    paymentGateway: { type: String, default: "" },

    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

historySchema.index({ type: 1 });
historySchema.index({ userId: 1 });
historySchema.index({ listenerId: 1 });
historySchema.index({ createdAt: -1 });

module.exports = mongoose.model("History", historySchema);
