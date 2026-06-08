const { LISTENER_REQUEST_STATUS } = require("../types/constant");

const mongoose = require("mongoose");

const listenerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    name: { type: String, default: "" },
    nickName: { type: String, default: "" },
    email: { type: String, default: "" },
    selfIntro: { type: String, default: "" },
    gender: { type: String, default: "" },
    age: { type: Number, default: 18 },
    phoneNumber: { type: String, default: "" },

    talkTopics: { type: Array, default: [] },
    language: { type: Array, default: [] },
    image: { type: String, default: "" },
    location: { type: String, default: "" },
    country: { type: String, default: "" },

    fcmToken: { type: String, default: null },
    uniqueId: { type: String, unique: true, default: "" },

    identityProofType: { type: String, default: "" },
    identityProof: { type: Array, default: [] },
    reason: { type: String, default: "" },
    status: { type: Number, enum: LISTENER_REQUEST_STATUS, default: 1 },

    ratePrivateVideoCall: { type: Number, default: 0 },
    ratePrivateAudioCall: { type: Number, default: 0 },
    rateRandomVideoCall: { type: Number, default: 0 },
    rateRandomAudioCall: { type: Number, default: 0 },

    video: { type: Array, default: [] },
    audio: { type: String, default: "" },

    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    callCount: { type: Number, default: 0 },
    experience: { type: String, default: "" },

    totalCoins: { type: Number, default: 0 }, //All coins ever earned
    currentCoinBalance: { type: Number, default: 0 }, //Coins remaining after redemptions/spending

    coinsRedeemed: { type: Number, default: 0 },
    amountRedeemed: { type: Number, default: 0 },

    isAvailableForPrivateAudioCall: { type: Boolean, default: false },
    isAvailableForPrivateVideoCall: { type: Boolean, default: false },
    isAvailableForRandomAudioCall: { type: Boolean, default: false },
    isAvailableForRandomVideoCall: { type: Boolean, default: false },
    isAvailableForChat: { type: Boolean, default: false },

    isNotificationEnabled: { type: Boolean, default: true },

    isFake: { type: Boolean, default: false },
    isBlock: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    isBusy: { type: Boolean, default: false },
    callId: { type: String, default: null },

    date: { type: String, default: "" },
    reviewAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

listenerSchema.index({ isBlock: 1, isFake: 1, status: 1, userId: 1 });
listenerSchema.index({ isFake: 1, isBlock: 1, isOnline: 1, isBusy: 1, callId: 1 });
listenerSchema.index({ isFake: 1 });
listenerSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Listener", listenerSchema);
