const WithdrawRecord = require("../../models/withdrawalRecord.model");

//import model
const Listener = require("../../models/listener.model");
const History = require("../../models/history.model");

//mongoose
const mongoose = require("mongoose");

//privateKey
const admin = require("../../util/privateKey");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//submit withdraw record
exports.addWithdrawalRecord = async (req, res) => {
  try {
    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Withdrawal settings not found." });
    }

    const { listenerId, paymentGateway, paymentDetails, coin } = req.body;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    if (!paymentGateway || !paymentDetails || !coin) {
      return res.status(200).json({ status: false, message: "Invalid request. Please provide all required fields." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(listenerId);
    const formattedGateway = paymentGateway.trim();
    const requestedCoins = Number(coin);
    const requestAmount = parseFloat(requestedCoins / settingJSON.minimumCoinsForConversion).toFixed(2);

    const [uniqueId, listener, pendingRequest, declinedRequest] = await Promise.all([
      generateHistoryUniqueId(),
      Listener.findOne({ _id: listenerObjId }).select("_id currentCoinBalance fcmToken").lean(),
      WithdrawRecord.findOne({ listenerId: listenerObjId, status: 1 }).select("_id").lean(), // status 1: pending
      //WithdrawRecord.findOne({ listenerId: listenerObjId, status: 3 }).select("_id").lean(), // status 3: declined
    ]);

    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener account not found." });
    }

    if (requestedCoins > listener.currentCoinBalance) {
      return res.status(200).json({ status: false, message: "Insufficient balance to request withdrawal." });
    }

    if (requestedCoins < settingJSON.minimumCoinsForPayout) {
      return res.status(200).json({ status: false, message: `Minimum withdrawal amount is ${settingJSON.minimumCoinsForPayout} coins.` });
    }

    if (pendingRequest) {
      return res.status(200).json({ status: false, message: "You already have a pending withdrawal request under review." });
    }

    const withdrawalData = {
      uniqueId,
      status: 1,
      listenerId: listener._id,
      coin: requestedCoins,
      amount: requestAmount,
      paymentGateway: formattedGateway,
      paymentDetails: paymentDetails,
      requestDate: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    console.log("paymentDetails type:", typeof paymentDetails);
    console.log("paymentDetails value:", paymentDetails);

    const historyData = {
      uniqueId,
      listenerId: listener._id,
      listenerCoin: requestedCoins,
      paymentGateway: formattedGateway,
      payoutStatus: 1,
      type: 7,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    // if (declinedRequest) {
    //   res.status(200).json({
    //     status: true,
    //     message: "Previous declined request removed. New withdrawal request submitted successfully.",
    //   });

    //   await WithdrawRecord.deleteOne({ _id: declinedRequest._id });
    //   await Promise.all([WithdrawRecord.create(withdrawalData), History.create(historyData)]);
    // } else {
    res.status(200).json({
      status: true,
      message: "Your withdrawal request has been submitted successfully and is under review.",
    });

    await Promise.all([WithdrawRecord.create(withdrawalData), History.create(historyData)]);
    // }

    if (listener.fcmToken) {
      const notificationPayload = {
        token: listener.fcmToken,
        notification: {
          title: "💸 Withdrawal Request Received ⏳",
          body: "✅ We've received your withdrawal request and it's being processed. You'll be notified once it's complete! 🔐💼",
        },
        data: {
          type: "WITHDRAWAL_REQUEST",
        },
      };

      const adminApp = await admin;
      adminApp
        .messaging()
        .send(notificationPayload)
        .then((response) => {
          console.log("Notification sent successfully:", response);
        })
        .catch((err) => {
          console.error("Notification sending failed:", err);
        });
    }
  } catch (err) {
    console.error("Withdrawal request error:", err);
    return res.status(500).json({ status: false, message: "Internal server error. Please try again later." });
  }
};

//get withdraw records
exports.getPayoutRecords = async (req, res) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formattedStartDate = new Date(startDate);
      const formattedEndDate = new Date(endDate);
      formattedEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: formattedStartDate,
          $lte: formattedEndDate,
        },
      };
    }

    const listenerObjId = new mongoose.Types.ObjectId(req.query.listenerId);

    const [host, records] = await Promise.all([
      Listener.findOne({ _id: listenerObjId }).select("_id").lean(),
      WithdrawRecord.find({ listenerId: listenerObjId, ...dateFilterQuery })
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host account not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Withdrawal requests retrieved successfully.",
      data: records.length > 0 ? records : [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
