const History = require("../../models/history.model");

//mongoose
const mongoose = require("mongoose");

//get coin history
exports.fetchCoinWalletHistory = async (req, res) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(listenerId);
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    }

    const [transactionHistory] = await Promise.all([
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $nin: [1, 2] },
            listenerId: listenerObjId,
            listenerCoin: { $gt: 0 },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { userId: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$userId"] },
                },
              },
              {
                $project: {
                  fullName: 1,
                  profilePic: 1,
                  _id: 0,
                },
              },
            ],
            as: "userDetails",
          },
        },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: false } },
        {
          $project: {
            _id: 1,
            type: 1,
            listenerCoin: 1,
            duration: 1,
            payoutStatus: 1,
            date: 1,
            createdAt: 1,
            fullName: { $ifNull: ["$userDetails.fullName", ""] },
            profilePic: { $ifNull: ["$userDetails.profilePic", ""] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get call history
exports.retrieveCallHistory = async (req, res) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(listenerId);
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    }

    const [transactionHistory] = await Promise.all([
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [3, 4, 5, 6] },
            listenerId: listenerObjId,
          },
        },
        {
          $lookup: {
            from: "users",
            let: { userId: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$userId"] },
                },
              },
              {
                $project: {
                  fullName: 1,
                  profilePic: 1,
                  _id: 0,
                },
              },
            ],
            as: "userDetails",
          },
        },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            callStatusText: {
              $cond: [
                { $eq: ["$callConnect", false] },
                "Missed Call",
                {
                  $cond: [{ $eq: ["$callerRole", "listener"] }, "Outgoing Call", "Incoming Call"],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            duration: 1,
            date: 1,
            createdAt: 1,
            callStatusText: 1,
            userId: 1,
            fullName: { $ifNull: ["$userDetails.fullName", ""] },
            profilePic: { $ifNull: ["$userDetails.profilePic", ""] },
            isOnline: "$userDetails.isOnline",
            coin: "$userCoin",
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};
