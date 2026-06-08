const User = require("../../models/user.model");
const Listener = require("../../models/listener.model");
const TalkTopic = require("../../models/talkTopic.model");
const WithdrawalRecord = require("../../models/withdrawalRecord.model");
const History = require("../../models/history.model");

//get dashboard count
exports.getAdminDashboardStats = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formatStartDate = new Date(startDate);
      const formatEndDate = new Date(endDate);
      formatEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: formatStartDate,
          $lte: formatEndDate,
        },
      };
    }

    const [totalUsers, totalBlockedUsers, totalPendingListeners, totalListeners, totalTalkTopics, totalPendingWithdrawalRecord] = await Promise.all([
      User.countDocuments(dateFilterQuery),
      User.countDocuments({ ...dateFilterQuery, isBlock: true }),
      Listener.countDocuments({ ...dateFilterQuery, status: 1 }),
      Listener.countDocuments({ ...dateFilterQuery, status: 2, isFake: false }),
      TalkTopic.countDocuments({ ...dateFilterQuery }),
      WithdrawalRecord.countDocuments({ ...dateFilterQuery, listenerId: { $ne: null }, status: 1 }),
    ]);

    return res.status(200).json({
      status: true,
      message: "Get admin panel dashboard listener count.",
      data: {
        totalUsers,
        totalBlockedUsers,
        totalPendingListeners,
        totalListeners,
        totalTalkTopics,
        totalPendingWithdrawalRecord,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get chat analytic
exports.fetchChartMetrics = async (req, res) => {
  try {
    if (!req.query.type) {
      return res.status(200).json({ status: false, message: "type must be requried!" });
    }

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const type = req.query.type.trim().toLowerCase();

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formatStartDate = new Date(startDate);
      const formatEndDate = new Date(endDate);
      formatEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: formatStartDate,
          $lte: formatEndDate,
        },
      };
    }

    let dateFilterQueryListener = {};
    if (startDate !== "All" && endDate !== "All") {
      const formatStartDate = new Date(startDate);
      const formatEndDate = new Date(endDate);
      formatEndDate.setHours(23, 59, 59, 999);

      dateFilterQueryListener = {
        reviewAt: {
          $gte: formatStartDate,
          $lte: formatEndDate,
        },
      };
    }

    if (type === "user") {
      const data = await User.aggregate([
        {
          $match: dateFilterQuery,
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return res.status(200).json({ status: true, message: "Success", chartUser: data });
    } else if (type === "listener") {
      const data = await Listener.aggregate([
        {
          $match: { ...dateFilterQueryListener, status: 2 },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$reviewAt" } },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return res.status(200).json({ status: true, message: "Success", chartListener: data });
    } else {
      return res.status(200).json({ status: false, message: "type must be passed valid." });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get new user
exports.getLatestUsers = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

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

    const users = await User.aggregate([
      { $match: { ...dateFilterQuery } },
      {
        $project: {
          _id: 1,
          uniqueId: 1,
          nickName: 1,
          fullName: 1,
          profilePic: 1,
          email: 1,
          gender: 1,
          coins: 1,
          isOnline: 1,
          loginType: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json({
      status: true,
      message: "Newly signed up users retrieved successfully!",
      data: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get top spenders
exports.getTopContributorsList = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

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

    const topSpenders = await History.aggregate([
      { $match: { ...dateFilterQuery, type: { $in: [3, 4, 5, 6] } } },
      {
        $group: {
          _id: "$userId",
          totalCoinsSpent: { $sum: "$userCoin" },
        },
      },
      { $match: { totalCoinsSpent: { $gt: 0 } } },
      {
        $sort: { totalCoinsSpent: -1 },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 0,
          //userId: "$_id",
          totalCoinsSpent: 1,
          uniqueId: "$user.uniqueId",
          nickName: "$user.nickName",
          fullName: "$user.fullName",
          profilePic: "$user.profilePic",
          email: "$user.email",
          isOnline: "$user.isOnline",
          loginType: "$user.loginType",
        },
      },
    ]);

    res.status(200).json({
      status: true,
      message: "Top spenders fetched successfully",
      data: topSpenders,
    });
  } catch (error) {
    console.error("Top Spenders Error:", error);
    res.status(500).json({ status: false, message: "Something went wrong", error: error.message });
  }
};

//get top performing listeners
exports.getTopPerformingListeners = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

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

    const topListeners = await History.aggregate([
      { $match: { ...dateFilterQuery, type: { $in: [3, 4, 5, 6] } } },
      {
        $group: {
          _id: "$listenerId",
          totalCoinReceived: { $sum: "$listenerCoin" },
        },
      },
      { $match: { totalCoinReceived: { $gt: 0 } } },
      {
        $sort: { totalCoinReceived: -1 },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: "listeners",
          localField: "_id",
          foreignField: "_id",
          as: "listener",
        },
      },
      { $unwind: { path: "$listener", preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 0,
          totalCoinReceived: 1,
          uniqueId: "$listener.uniqueId",
          image: "$listener.image",
          email: "$listener.email",
          name: "$listener.name",
          nickName: "$listener.nickName",
          isOnline: "$listener.isOnline",
        },
      },
    ]);

    res.status(200).json({
      status: true,
      message: "Top performing listeners fetched successfully",
      data: topListeners,
    });
  } catch (error) {
    console.error("Top Performing Listeners Error:", error);
    res.status(500).json({ status: false, message: "Something went wrong", error: error.message });
  }
};
