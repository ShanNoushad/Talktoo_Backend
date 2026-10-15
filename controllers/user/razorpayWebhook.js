const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../../models/user.model");
const History = require("../../models/history.model");
const CoinPlan = require("../../models/coinplan.model");
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.warn("Razorpay webhook: invalid signature");
      return res.status(400).json({ status: false, message: "Invalid signature" });
    }

    const event = req.body.event;

    if (event === "payment.captured") {
      const payment = req.body.payload.payment.entity;
      const notes = payment.notes || {};
      const { userId, coinPlanId } = notes;

      if (!userId || !coinPlanId) {
        console.warn("Razorpay webhook: missing notes on payment", payment.id);
        return res.status(200).json({ status: true, message: "No matching user/plan notes; ignored." });
      }

      const alreadyProcessed = await History.findOne({ "meta.razorpayPaymentId": payment.id }).lean();
      if (alreadyProcessed) {
        return res.status(200).json({ status: true, message: "Already processed." });
      }

      const coinPlan = await CoinPlan.findById(coinPlanId).select("_id coins price").lean();
      if (!coinPlan) {
        console.warn("Razorpay webhook: coinPlan not found", coinPlanId);
        return res.status(200).json({ status: true, message: "CoinPlan not found; ignored." });
      }

      const totalCoins = coinPlan.coins || 0;
      const uniqueId = await generateHistoryUniqueId();

      await Promise.all([
        User.updateOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          { $inc: { coins: totalCoins, coinsRecharged: totalCoins } }
        ),
        History.create({
          uniqueId,
          type: 2,
          userId: new mongoose.Types.ObjectId(userId),
          userCoin: totalCoins,
          price: coinPlan.price || 0,
          paymentGateway: "Razorpay",
          date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
          meta: { razorpayPaymentId: payment.id },
        }),
      ]);

      console.log(`Webhook credited ${totalCoins} coins to user ${userId} via payment ${payment.id}`);
    }

    return res.status(200).json({ status: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return res.status(500).json({ status: false, error: error.message });
  }
};