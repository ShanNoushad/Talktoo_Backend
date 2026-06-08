const CoinPlan = require("../../models/coinplan.model");

//import model
const User = require("../../models/user.model");
const History = require("../../models/history.model");

//mongoose
const mongoose = require("mongoose");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//get coinPlan
exports.getAvailableCoinPackage = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Access denied. Invalid authentication token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const [user, coinPlan] = await Promise.all([User.findOne({ _id: userId }).select("coins").lean(), CoinPlan.find({ isActive: true }).sort({ coin: 1, price: 1 }).lean()]);

    return res.status(200).json({
      status: true,
      message: "Retrive CoinPlan Successfully",
      userCoin: user.coins || 0,
      data: coinPlan,
    });
  } catch {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

//purchase coinPlan ( coinPlan history )
exports.recordPurchasedCoinPlan = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { coinPlanId, paymentGateway } = req.query;

    if (!coinPlanId || !paymentGateway) {
      return res.json({ status: false, message: "Oops! Invalid details." });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const coinPlanObjectId = new mongoose.Types.ObjectId(coinPlanId);
    const trimmedPaymentGateway = paymentGateway.trim();

    const [uniqueId, user, coinPlan] = await Promise.all([
      generateHistoryUniqueId(),
      User.findById(userObjectId).select("_id").lean(),
      CoinPlan.findById(coinPlanObjectId).select("_id coins price").lean(),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "user does not found." });
    }

    if (!coinPlan) {
      return res.status(200).json({ status: false, message: "CoinPlan does not found." });
    }

    const totalCoins = coinPlan.coins || 0;

    const [updateedUser, history] = await Promise.all([
      User.updateOne({ _id: userObjectId }, { $inc: { coins: totalCoins, coinsRecharged: totalCoins } }),
      History.create({
        uniqueId: uniqueId,
        type: 2,
        userId: user._id,
        userCoin: totalCoins,
        price: coinPlan.price || 0,
        paymentGateway: trimmedPaymentGateway,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
    ]);

    res.status(200).json({
      status: true,
      message: "Coin plan history created successfully after user purchase.",
      totalCoins: totalCoins,
      historyRecord: {
        transactionId: uniqueId,
        date: history.date,
        amountPaid: coinPlan.price || 0,
        paymentMode: trimmedPaymentGateway,
        userCoin: totalCoins,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
