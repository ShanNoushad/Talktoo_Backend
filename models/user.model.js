const { LOGIN_TYPE } = require("../types/constant");

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    nickName: { type: String, default: "" },
    fullName: { type: String, default: "" },
    birthDate: { type: String, default: "" },
    gender: { type: String, default: "" },
    bio: { type: String, default: "" },
    age: { type: Number, default: 18 },
    countryCode: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    profilePic: { type: String, default: "" },
    email: { type: String, default: "" },
    password: { type: String, default: "" },
    countryFlag: { type: String, default: "" },
    country: { type: String, trim: true, lowercase: true, default: "" },
    loginType: { type: Number, enum: LOGIN_TYPE }, //1.google 2.quick(identity) 3.mobile-number 4.email-password 5.apple
    identity: { type: String, default: "" },
    fcmToken: { type: String, default: null },
    uniqueId: { type: String, unique: true, default: "" },

    firebaseId: { type: String, unique: true, default: "" }, //firebase uid
    authProvider: { type: String, default: "" },

    coins: { type: Number, default: 0 },
    coinsSpent: { type: Number, default: 0 },
    coinsRecharged: { type: Number, default: 0 }, //totalTopUp (Total coins the user has topped up)

    isBlock: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    isBusy: { type: Boolean, default: false },
    isNotificationEnabled: { type: Boolean, default: true },

    callId: { type: String, default: null }, //for videoCall

    isListener: { type: Boolean, default: false },
    listenerId: { type: mongoose.Schema.Types.ObjectId, ref: "Listener", default: null },

    lastlogin: { type: String, default: "" },
    date: { type: String, default: "" },

    interests: {
      therapyType: { type: String, default: "" },
      gender: { type: String, default: "" },
      ageRange: { type: String, default: "" },
      country: { type: String, default: "" },
      sexualOrientation: { type: String, default: "" },
      religion: { type: String, default: "" },
      takesMedication: { type: Boolean, default: false },
      preferredLanguage: { type: String, default: "" },
      needHelpWith: [{ type: String }],
      communicationType: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ identity: 1, loginType: 1 });
userSchema.index({ isBlock: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
