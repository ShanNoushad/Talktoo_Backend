const User = require("../../models/user.model");
const History = require("../../models/history.model");

//mongoose
const mongoose = require("mongoose");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//get users
exports.listRegisteredUsers = async (req, res) => {
  try {
    const { userId, gender = "All" } = req.query || {};

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const searchString = req.query.search || "";
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

    let searchQuery = {};
    if (searchString !== "All" && searchString !== "") {
      searchQuery = {
        $or: [
          { nickName: { $regex: searchString, $options: "i" } },
          { fullName: { $regex: searchString, $options: "i" } },
          { email: { $regex: searchString, $options: "i" } },
          { uniqueId: { $regex: searchString, $options: "i" } },
        ],
      };
    }

    let filterQuery = {};

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filterQuery._id = new mongoose.Types.ObjectId(userId);
    } else if (userId) {
      return res.status(200).json({ status: false, message: "Invalid userId" });
    }

    const isBlockParam = req.query.isBlock ?? "All";
    const isOnlineParam = req.query.isOnline ?? "All";
    const roleParam = req.query.isListener ?? "All";

    if (isBlockParam !== "All" && isBlockParam !== "") {
      filterQuery.isBlock = isBlockParam === "true";
    }

    if (isOnlineParam !== "All" && isOnlineParam !== "") {
      filterQuery.isOnline = isOnlineParam === "true";
    }

    if (roleParam !== "All" && roleParam !== "") {
      filterQuery.isListener = roleParam === "true";
    }

    if (gender !== "All") {
      filterQuery.gender = gender.trim().toLowerCase();
    }

    let filter = {
      ...dateFilterQuery,
      ...searchQuery,
      ...filterQuery,
    };

    const [totalActiveUsers, totalMaleUsers, totalFemaleUsers, totalUsers, users] = await Promise.all([
      User.countDocuments({ isBlock: false, ...dateFilterQuery }),
      User.countDocuments({ gender: "male", ...dateFilterQuery }),
      User.countDocuments({ gender: "female", ...dateFilterQuery }),
      User.countDocuments(filter),
      User.aggregate([
        { $match: filter },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            nickName: 1,
            fullName: 1,
            birthDate: 1,
            gender: 1,
            countryCode: 1,
            phoneNumber: 1,
            countryFlag: 1,
            country: 1,
            profilePic: 1,
            email: 1,
            coins: 1,
            coinsSpent: 1,
            coinsRecharged: 1,
            loginType: 1,
            isBlock: 1,
            isOnline: 1,
            isBusy: 1,
            isListener: 1,
            lastlogin: 1,
            date: 1,
            createdAt: 1,
          },
        },
        { $sort: { createdAt: -1 } },
        ...(userId ? [] : [{ $skip: (start - 1) * limit }, { $limit: limit }]),
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Retrieved real users!",
      totalActiveUsers,
      totalMaleUsers,
      totalFemaleUsers,
      total: totalUsers,
      data: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//toggle user's block status
exports.toggleUserBlock = async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    const user = await User.findById(userId).select("uniqueId name image countryFlagImage country gender coin coinsRecharged isHost isVip isBlock isFake loginType createdAt");
    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    user.isBlock = !user.isBlock;
    await user.save();

    return res.status(200).json({
      status: true,
      message: `User has been ${user.isBlock ? "blocked" : "unblocked"} successfully.`,
      data: user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "An error occurred while updating user block status." });
  }
};

//get users ( drop - down )
exports.retrieveUserList = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const query = {
      ...(search !== "All" && search.trim() !== ""
        ? {
            $or: [{ nickName: { $regex: search, $options: "i" } }, { fullName: { $regex: search, $options: "i" } }, { uniqueId: { $regex: search, $options: "i" } }],
          }
        : {}),
      isListener: false,
    };

    const users = await User.find(query).select("_id nickName fullName profilePic uniqueId").lean();

    return res.status(200).json({
      status: true,
      message: `Retrieved users!`,
      data: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//admin can add or deduct coins from a user's wallet
exports.adjustUserCoins = async (req, res, next) => {
  try {
    const { userId, coin, action } = req.body;

    if (!userId || !coin || !action) {
      return res.status(400).json({
        status: false,
        message: "userId, coin, and action are required fields.",
      });
    }

    if (!["add", "deduct"].includes(action)) {
      return res.status(400).json({
        status: false,
        message: "Invalid action. Must be 'add' or 'deduct'.",
      });
    }

    if (isNaN(coin) || coin <= 0) {
      return res.status(400).json({
        status: false,
        message: "Coin must be a positive number.",
      });
    }

    const [uniqueId, user] = await Promise.all([generateHistoryUniqueId(), User.findById(userId).lean()]);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    let newCoinBalance = user.coins;
    let updatedFields = {};

    if (action === "add") {
      newCoinBalance += coin;
      updatedFields = {
        coins: newCoinBalance,
        coinsRecharged: (user.coinsRecharged || 0) + coin,
      };
    } else {
      if (user.coins < coin) {
        return res.status(400).json({
          status: false,
          message: "Insufficient balance to deduct coins.",
        });
      }
      newCoinBalance -= coin;
      updatedFields = {
        coins: newCoinBalance,
      };
    }

    await Promise.all([
      User.findByIdAndUpdate(userId, updatedFields, { new: true }).lean(),
      History.create({
        uniqueId: uniqueId,
        type: action === "add" ? 8 : 9,
        userId,
        userCoin: coin,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
    ]);

    return res.status(200).json({
      status: true,
      message: `Successfully ${action === "add" ? "added" : "deducted"} ${coin} coins.`,
    });
  } catch (error) {
    console.error("Admin Coin Update Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};
