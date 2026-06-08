const WithdrawalRecord = require("../../models/withdrawalRecord.model");

//import model
const Listener = require("../../models/listener.model");
const History = require("../../models/history.model");
const Notification = require("../../models/notification.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//get listener's withdrawal requests
exports.retrieveWithdrawalRecords = async (req, res) => {
  try {
    const { status, search } = req.query || {};

    if (!status) {
      return res.status(200).json({
        status: false,
        message: "Invalid query parameters.",
      });
    }

    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    const dateFilter = {};
    if (startDate !== "All" && endDate !== "All") {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const statusFilter = {};
    if (status !== "All") {
      statusFilter.status = parseInt(status);
    }

    const baseMatch = {
      ...statusFilter,
      ...dateFilter,
      listenerId: { $ne: null },
    };

    const searchMatch =
      search && search.trim() !== ""
        ? {
            $or: [{ uniqueId: { $regex: search, $options: "i" } }, { "listenerId.name": { $regex: search, $options: "i" } }, { "listenerId.uniqueId": { $regex: search, $options: "i" } }],
          }
        : null;

    const result = await WithdrawalRecord.aggregate([
      { $match: baseMatch },

      {
        $lookup: {
          from: "listeners",
          let: { listenerId: "$listenerId" },
          pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$listenerId"] } } }, { $project: { name: 1, uniqueId: 1, image: 1 } }],
          as: "listenerId",
        },
      },
      { $unwind: { path: "$listenerId", preserveNullAndEmptyArrays: true } },

      ...(searchMatch ? [{ $match: searchMatch }] : []),

      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $sort: { createdAt: -1 } }, { $skip: (start - 1) * limit }, { $limit: limit }],
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      message: "Withdrawal requests retrieved successfully.",
      total: result[0]?.metadata[0]?.total || 0,
      data: result[0]?.data || [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//accept or decline withdrawal listener's requests
exports.updateWithdrawalRecords = async (req, res) => {
  try {
    const { requestId, listenerId, type, reason } = req.query;

    if (!requestId || !listenerId || !type) {
      return res.status(200).json({ status: false, message: "Missing required parameters." });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(200).json({ status: false, message: "Invalid requestId. It must be a valid MongoDB ObjectId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(listenerId);
    const actionType = Number(type);
    const dateNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    const [request, listener] = await Promise.all([
      WithdrawalRecord.findById(requestId).lean().select("_id listenerId coin amount status uniqueId"),
      Listener.findOne({ _id: listenerObjId }).select("_id currentCoinBalance fcmToken isBlock isNotificationEnabled").lean(),
    ]);

    if (!listener) return res.status(200).json({ status: false, message: "Listener not found." });
    if (!request) return res.status(200).json({ status: false, message: "Withdrawal request not found." });
    if (request.status === 2) return res.status(200).json({ status: false, message: "Request already approved." });
    if (request.status === 3) return res.status(200).json({ status: false, message: "Request already declined." });

    const requestedCoins = request.coin || 0;
    if (requestedCoins > listener.currentCoinBalance) {
      return res.status(200).json({ status: false, message: "Insufficient balance to request withdrawal." });
    }

    if (actionType === 2) {
      res.status(200).json({
        status: true,
        message: "Withdrawal request approved successfully.",
      });

      await Promise.all([
        WithdrawalRecord.updateOne(
          { _id: request._id, listenerId: listenerObjId },
          {
            $set: {
              status: 2,
              acceptOrDeclineDate: dateNow,
            },
          },
        ),
        History.updateOne(
          { uniqueId: request.uniqueId, type: 7 },
          {
            $set: {
              payoutStatus: 2,
              date: dateNow,
            },
          },
        ),
        Listener.updateOne(
          {
            _id: listenerObjId,
            currentCoinBalance: { $gt: 0 },
          },
          {
            $inc: {
              currentCoinBalance: -request.coin,
              coinsRedeemed: request.coin,
              amountRedeemed: request.amount,
            },
          },
        ),
      ]);

      if (listener.isNotificationEnabled && !listener.isBlock && listener.fcmToken) {
        const payload = {
          token: listener.fcmToken,
          data: {
            title: "✅ Withdrawal Approved!",
            body: "🎉 Great news! Your withdrawal has been successfully approved. Keep up the great work! 💼💰",
            type: "WITHDRAWREQUEST",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);

          const notification = new Notification();
          notification.listenerId = listener._id;
          notification.title = `✅ Withdrawal Approved!`;
          notification.message = `🎉 Great news! Your withdrawal has been successfully approved. Keep up the great work! 💼💰`;
          notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          await notification.save();
        } catch (err) {
          console.error("FCM error:", err.message);
        }
      }
    } else if (actionType === 3) {
      if (!reason) {
        return res.status(200).json({ status: false, message: "Rejection reason is required." });
      }

      res.status(200).json({
        status: true,
        message: "Withdrawal request declined.",
      });

      await Promise.all([
        WithdrawalRecord.updateOne(
          { _id: request._id, listenerId: listenerObjId },
          {
            $set: {
              status: 3,
              reason: reason.trim(),
              acceptOrDeclineDate: dateNow,
            },
          },
        ),
        History.updateOne(
          { uniqueId: request.uniqueId, type: 7 },
          {
            $set: {
              payoutStatus: 3,
              reason,
              date: dateNow,
            },
          },
        ),
      ]);

      if (listener.isNotificationEnabled && !listener.isBlock && listener.fcmToken) {
        const payload = {
          token: listener.fcmToken,
          data: {
            title: "❌ Withdrawal Declined",
            body: "⚠️ Your withdrawal request was declined. Please review the reason or contact support. 📩",
            type: "WITHDRAWREQUEST",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);

          const notification = new Notification();
          notification.listenerId = listener._id;
          notification.title = `❌ Withdrawal Declined`;
          notification.message = `⚠️ Your withdrawal request was declined. Please review the reason or contact support. 📩`;
          notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          await notification.save();
        } catch (err) {
          console.error("FCM error:", err.message);
        }
      }
    } else {
      return res.status(200).json({
        status: false,
        message: "Invalid type. Must be 'approve' (2) or 'reject' (3)..",
      });
    }
  } catch (error) {
    console.error("Error in updateWithdrawalRecords:", error);
    res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
