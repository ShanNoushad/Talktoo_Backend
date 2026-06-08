const Setting = require("../../models/setting.model");

//import model
const Listener = require("../../models/listener.model");

//update setting
exports.modifySetting = async (req, res) => {
  try {
    if (!req.query.settingId) {
      return res.status(200).json({ status: false, message: "SettingId mumst be requried." });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    setting.helpdeskEmail = req.body.helpdeskEmail ? req.body.helpdeskEmail.trim() : setting.helpdeskEmail;

    setting.zegoAppId = req.body.zegoAppId ? req.body.zegoAppId.trim() : setting.zegoAppId;
    setting.zegoAppSignIn = req.body.zegoAppSignIn ? req.body.zegoAppSignIn.trim() : setting.zegoAppSignIn;

    setting.userPrivacyPolicyUrl = req.body.userPrivacyPolicyUrl ? req.body.userPrivacyPolicyUrl.trim() : setting.userPrivacyPolicyUrl;
    setting.listenerPrivacyPolicyUrl = req.body.listenerPrivacyPolicyUrl ? req.body.listenerPrivacyPolicyUrl.trim() : setting.listenerPrivacyPolicyUrl;
    setting.aboutUsUrl = req.body.aboutUsUrl ? req.body.aboutUsUrl.trim() : setting.aboutUsUrl;

    setting.paystackPublicKey = req.body.paystackPublicKey ? req.body.paystackPublicKey.trim() : setting.paystackPublicKey;
    setting.paystackSecretKey = req.body.paystackSecretKey ? req.body.paystackSecretKey.trim() : setting.paystackSecretKey;
    setting.cashfreeClientId = req.body.cashfreeClientId ? req.body.cashfreeClientId.trim() : setting.cashfreeClientId;
    setting.cashfreeClientSecret = req.body.cashfreeClientSecret ? req.body.cashfreeClientSecret.trim() : setting.cashfreeClientSecret;
    setting.paypalClientId = req.body.paypalClientId ? req.body.paypalClientId.trim() : setting.paypalClientId;
    setting.paypalSecretKey = req.body.paypalSecretKey ? req.body.paypalSecretKey.trim() : setting.paypalSecretKey;

    setting.stripePublicKey = req.body.stripePublicKey ? req.body.stripePublicKey.trim() : setting.stripePublicKey;
    setting.stripeSecretKey = req.body.stripeSecretKey ? req.body.stripeSecretKey.trim() : setting.stripeSecretKey;
    setting.razorpayKeyId = req.body.razorpayKeyId ? req.body.razorpayKeyId.trim() : setting.razorpayKeyId;
    setting.razorpayKeySecret = req.body.razorpayKeySecret ? req.body.razorpayKeySecret.trim() : setting.razorpayKeySecret;
    setting.flutterwavePublicKey = req.body.flutterwavePublicKey ? req.body.flutterwavePublicKey.trim() : setting.flutterwavePublicKey;
    setting.dailyLoginBonusCoins = req.body.dailyLoginBonusCoins ? Number(req.body.dailyLoginBonusCoins) : setting.dailyLoginBonusCoins;
    setting.adminCommissionPercent = req.body.adminCommissionPercent ? Number(req.body.adminCommissionPercent) : setting.adminCommissionPercent;
    setting.minimumCoinsForConversion = req.body.minimumCoinsForConversion ? Number(req.body.minimumCoinsForConversion) : setting.minimumCoinsForConversion;
    setting.minimumCoinsForPayout = req.body.minimumCoinsForPayout ? Number(req.body.minimumCoinsForPayout) : setting.minimumCoinsForPayout;

    setting.androidAppVersion = req.body.androidAppVersion ? req.body.androidAppVersion.trim() : setting.androidAppVersion;
    setting.iosAppVersion = req.body.iosAppVersion ? req.body.iosAppVersion.trim() : setting.iosAppVersion;
    setting.androidAppLink = req.body.androidAppLink ? req.body.androidAppLink.trim() : setting.androidAppLink;
    setting.iosAppLink = req.body.iosAppLink ? req.body.iosAppLink.trim() : setting.iosAppLink;

    if (req.body.privateKey) {
      setting.privateKey = typeof req.body.privateKey === "string" ? JSON.parse(req.body.privateKey.trim()) : req.body.privateKey;
    }

    setting.videoCallRatePrivate = req.body.videoCallRatePrivate !== undefined ? Number(req.body.videoCallRatePrivate) : setting.videoCallRatePrivate;
    setting.audioCallRatePrivate = req.body.audioCallRatePrivate !== undefined ? Number(req.body.audioCallRatePrivate) : setting.audioCallRatePrivate;
    setting.videoCallRateRandom = req.body.videoCallRateRandom !== undefined ? Number(req.body.videoCallRateRandom) : setting.videoCallRateRandom;
    setting.audioCallRateRandom = req.body.audioCallRateRandom !== undefined ? Number(req.body.audioCallRateRandom) : setting.audioCallRateRandom;

    await setting.save();

    res.status(200).json({
      status: true,
      message: "Setting has been Updated.",
      data: setting,
    });

    // await Listener.updateMany(
    //   {},
    //   {
    //     $set: {
    //       ratePrivateVideoCall: setting.videoCallRatePrivate,
    //       ratePrivateAudioCall: setting.audioCallRatePrivate,
    //       rateRandomVideoCall: setting.videoCallRateRandom,
    //       rateRandomAudioCall: setting.audioCallRateRandom,
    //     },
    //   }
    // );

    updateSettingFile(setting);

    if (req.body.privateKey) {
      try {
        setTimeout(() => {
          console.log("🔐 Private key updated, restarting server...");
          process.exit(0);
        }, 500); // 0.5s delay
        return;
      } catch (err) {
        console.error("Failed to update privateKey:", err);
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update setting switch
exports.toggleAppSetting = async (req, res) => {
  try {
    if (!req.query.settingId || !req.query.type) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    const type = req.query.type.trim();

    if (type === "isGooglePlayEnabled") {
      setting.isGooglePlayEnabled = !setting.isGooglePlayEnabled;
    } else if (type === "isStripeEnabled") {
      setting.isStripeEnabled = !setting.isStripeEnabled;
    } else if (type === "isRazorpayEnabled") {
      setting.isRazorpayEnabled = !setting.isRazorpayEnabled;
    } else if (type === "isFlutterwaveEnabled") {
      setting.isFlutterwaveEnabled = !setting.isFlutterwaveEnabled;
    } else if (type === "isGooglePlayIosEnabled") {
      setting.isGooglePlayIosEnabled = !setting.isGooglePlayIosEnabled;
    } else if (type === "isStripeIosEnabled") {
      setting.isStripeIosEnabled = !setting.isStripeIosEnabled;
    } else if (type === "isRazorpayIosEnabled") {
      setting.isRazorpayIosEnabled = !setting.isRazorpayIosEnabled;
    } else if (type === "isFlutterwaveIosEnabled") {
      setting.isFlutterwaveIosEnabled = !setting.isFlutterwaveIosEnabled;
    } else if (type === "isPaystackAndroidEnabled") {
      setting.isPaystackAndroidEnabled = !setting.isPaystackAndroidEnabled;
    } else if (type === "isPaystackIosEnabled") {
      setting.isPaystackIosEnabled = !setting.isPaystackIosEnabled;
    } else if (type === "isCashfreeAndroidEnabled") {
      setting.isCashfreeAndroidEnabled = !setting.isCashfreeAndroidEnabled;
    } else if (type === "isCashfreeIosEnabled") {
      setting.isCashfreeIosEnabled = !setting.isCashfreeIosEnabled;
    } else if (type === "isPaypalAndroidEnabled") {
      setting.isPaypalAndroidEnabled = !setting.isPaypalAndroidEnabled;
    } else if (type === "isPaypalIosEnabled") {
      setting.isPaypalIosEnabled = !setting.isPaypalIosEnabled;
    } else if (type === "isDemoContentEnabled") {
      setting.isDemoContentEnabled = !setting.isDemoContentEnabled;
    } else if (type === "isApplicationLive") {
      setting.isApplicationLive = !setting.isApplicationLive;
    } else if (type === "allowBecomeHostOption") {
      setting.allowBecomeHostOption = !setting.allowBecomeHostOption;
    } else {
      return res.status(200).json({ status: false, message: "type passed must be valid." });
    }

    await setting.save();

    res.status(200).json({ status: true, message: "Success", data: setting });

    updateSettingFile(setting);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get setting
exports.getSettingsData = async (req, res) => {
  try {
    const setting = settingJSON ? settingJSON : null;
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    return res.status(200).json({ status: true, message: "Success", data: setting });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
