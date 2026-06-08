const History = require("../../models/history.model");

//import model
const User = require("../../models/user.model");
const Listener = require("../../models/listener.model");

//mongoose
const mongoose = require("mongoose");

//get coin history ( user )
exports.getWalletHistory = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const userId = new mongoose.Types.ObjectId(req.query.userId);
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

    const baseMatch = {
      ...dateFilterQuery,
      type: { $nin: [7] },
      userId: userId,
      userCoin: { $gt: 0 },
    };

    const [user, total, transactionHistory, typeWiseStat] = await Promise.all([
      User.findOne({ _id: userId }).select("_id").lean(),
      History.countDocuments(baseMatch),
      History.aggregate([
        { $match: baseMatch },
        {
          $lookup: {
            from: "listeners",
            let: { listenerId: "$listenerId" },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$listenerId"] } } }, { $project: { name: 1, image: 1 } }],
            as: "listener",
          },
        },
        { $unwind: { path: "$listener", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            callStatusText: {
              $cond: [
                { $eq: ["$callConnect", false] },
                "Missed Call",
                {
                  $cond: [{ $eq: ["$callerRole", "user"] }, "Outgoing Call", "Incoming Call"],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            userCoin: 1,
            listenerCoin: 1,
            adminCoin: 1,
            callerRole: 1,
            callType: 1,
            isRandom: 1,
            isPrivate: 1,
            callStartTime: 1,
            callEndTime: 1,
            duration: 1,
            price: 1,
            paymentGateway: 1,
            date: 1,
            createdAt: 1,
            callStatusText: 1,
            receiverName: { $ifNull: ["$listener.name", ""] },
            receiverImage: { $ifNull: ["$listener.image", ""] },
            isIncome: {
              $cond: [{ $in: ["$type", [1, 2, 8]] }, true, false],
            },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
      History.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
        {
          $project: { type: "$_id", count: 1, _id: 0 },
        },
      ]),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found in the database." });
    }

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      total,
      data: transactionHistory,
      typeWiseStat,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get call history ( user )
exports.listCallRecords = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: userId." });
    }

    if (!req.query.userId || !mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(200).json({ status: false, message: "Valid userId is required." });
    }

    const userId = new mongoose.Types.ObjectId(req.query.userId);
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

    const [total, transactionHistory] = await Promise.all([
      History.countDocuments({
        ...dateFilterQuery,
        type: { $in: [3, 4, 5, 6] },
        userId: userId,
        userCoin: { $gt: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [3, 4, 5, 6] },
            userId: userId,
            userCoin: { $gt: 0 },
          },
        },
        {
          $lookup: {
            from: "listeners",
            let: { listenerId: "$listenerId" },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$listenerId"] } } }, { $project: { name: 1, image: 1 } }],
            as: "listener",
          },
        },
        { $unwind: { path: "$listener", preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            callStatusText: {
              $cond: [
                { $eq: ["$callConnect", false] },
                "Missed Call",
                {
                  $cond: [{ $eq: ["$callerRole", "user"] }, "Outgoing Call", "Incoming Call"],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            userCoin: 1,
            listenerCoin: 1,
            adminCoin: 1,
            callerRole: 1,
            callType: 1,
            isRandom: 1,
            isPrivate: 1,
            callStartTime: 1,
            callEndTime: 1,
            duration: 1,
            date: 1,
            createdAt: 1,
            callStatusText: 1,
            name: { $ifNull: ["$listener.name", ""] },
            image: { $ifNull: ["$listener.image", ""] },
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
      total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get coinplan history ( user )
exports.retrievePurchaseLog = async (req, res) => {
  try {
    if (!req.query.userId || !mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(200).json({
        status: false,
        message: "Valid userId is required.",
      });
    }

    const userId = new mongoose.Types.ObjectId(req.query.userId);
    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const { startDate = "All", endDate = "All", search } = req.query;

    const dateFilter = {};
    if (startDate !== "All" && endDate !== "All") {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const baseMatch = {
      ...dateFilter,
      type: 2,
      userId,
      price: { $exists: true, $ne: 0 },
      userCoin: { $gt: 0 },
    };

    const searchMatch = search
      ? {
          $or: [
            { uniqueId: { $regex: search, $options: "i" } },
            { paymentGateway: { $regex: search, $options: "i" } },
            {
              $expr: {
                $regexMatch: {
                  input: { $toString: "$price" },
                  regex: search,
                },
              },
            },
            {
              $expr: {
                $regexMatch: {
                  input: { $toString: "$userCoin" },
                  regex: search,
                },
              },
            },
          ],
        }
      : null;

    const [countAgg, transactionHistory] = await Promise.all([
      History.aggregate([{ $match: baseMatch }, ...(searchMatch ? [{ $match: searchMatch }] : []), { $count: "total" }]),
      History.aggregate([
        { $match: baseMatch },
        ...(searchMatch ? [{ $match: searchMatch }] : []),

        {
          $project: {
            _id: 1,
            uniqueId: 1,
            userCoin: 1,
            price: 1,
            paymentGateway: 1,
            date: 1,
            createdAt: 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Transaction history fetched successfully.",
      total: countAgg[0]?.total || 0,
      data: transactionHistory,
    });
  } catch (error) {
    console.error("retrievePurchaseLog error:", error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get coin history ( listener )
exports.fetchCoinTransactions = async (req, res) => {
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

    const [listener, total, transactionHistory] = await Promise.all([
      Listener.findOne({ _id: listenerId }).select("_id").lean(),
      History.countDocuments({
        ...dateFilterQuery,
        type: { $in: [3, 4, 5, 6, 7] },
        listenerId: listenerObjId,
        listenerCoin: { $gt: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [3, 4, 5, 6, 7] },
            listenerId: listenerObjId,
            listenerCoin: { $gt: 0 },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { userId: "$userId" },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } }, { $project: { fullName: 1, profilePic: 1 } }],
            as: "userDetails",
          },
        },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            callStatusText: {
              $cond: [
                { $eq: ["$callConnect", false] },
                "Missed Call",
                {
                  $cond: [{ $eq: ["$callerRole", "user"] }, "Outgoing Call", "Incoming Call"],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            userCoin: 1,
            listenerCoin: 1,
            adminCoin: 1,
            callerRole: 1,
            callType: 1,
            isRandom: 1,
            isPrivate: 1,
            callStartTime: 1,
            callEndTime: 1,
            duration: 1,
            payoutStatus: 1,
            paymentGateway: 1,
            callStatusText: 1,
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

    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener request not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get call history ( listener )
exports.fetchCallHistory = async (req, res) => {
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

    const [total, transactionHistory] = await Promise.all([
      History.countDocuments({
        ...dateFilterQuery,
        type: { $in: [3, 4, 5, 6] },
        listenerId: listenerObjId,
        listenerCoin: { $gt: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [3, 4, 5, 6] },
            listenerId: listenerObjId,
            listenerCoin: { $gt: 0 },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { userId: "$userId" },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } }, { $project: { nickName: 1, fullName: 1, profilePic: 1 } }],
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
            uniqueId: 1,
            callerRole: 1,
            callType: 1,
            isRandom: 1,
            isPrivate: 1,
            callStartTime: 1,
            callEndTime: 1,
            duration: 1,
            userCoin: 1,
            listenerCoin: 1,
            adminCoin: 1,
            date: 1,
            createdAt: 1,
            callStatusText: 1,
            nickName: { $ifNull: ["$userDetails.nickName", ""] },
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
      total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};
