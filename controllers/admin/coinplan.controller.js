const CoinPlan = require("../../models/coinplan.model");

//import model
const History = require("../../models/history.model");

//mongoose
const mongoose = require("mongoose");

//create a new coin plan
exports.addCoinPlan = async (req, res) => {
  try {
    const { coins, price, productId } = req.body;

    if (!coins || !price || !productId) {
      return res.status(200).json({ status: false, message: "coins, price, and productId are required." });
    }

    const newPlan = await CoinPlan.create({ coins, price, productId });
    return res.status(200).json({ status: true, message: "Coin plan created successfully.", data: newPlan });
  } catch (error) {
    console.error("Error in addCoinPlan:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//update an existing coin plan
exports.editCoinPlan = async (req, res) => {
  try {
    const { coinPlanId, coins, price, productId } = req.body;

    if (!coinPlanId) {
      return res.status(200).json({ status: false, message: "coinPlanId is required." });
    }

    const updated = await CoinPlan.findByIdAndUpdate(coinPlanId, { coins, price, productId }, { new: true, lean: true });

    if (!updated) {
      return res.status(200).json({ status: false, message: "Coin plan not found." });
    }

    return res.status(200).json({ status: true, message: "Coin plan updated successfully.", data: updated });
  } catch (error) {
    console.error("Error in editCoinPlan:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//toggle coin plan status (isActive or isPopular)
exports.toggleCoinPlanField = async (req, res) => {
  try {
    const { coinPlanId, field } = req.query;

    if (!coinPlanId || !["isActive", "isPopular"].includes(field)) {
      return res.status(200).json({ status: false, message: "Valid coinPlanId and field (isActive or isPopular) required." });
    }

    const plan = await CoinPlan.findById(coinPlanId);
    if (!plan) return res.status(200).json({ status: false, message: "Coin plan not found." });

    plan[field] = !plan[field];
    await plan.save();

    return res.status(200).json({ status: true, message: `Coin plan ${field} toggled.`, data: plan });
  } catch (error) {
    console.error("Error in toggleCoinPlanField:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//retrieve all coin plans
exports.listCoinPlans = async (req, res) => {
  try {
    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const [total, plans] = await Promise.all([
      CoinPlan.countDocuments(),
      CoinPlan.find()
        .sort({ coins: 1, price: 1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({ status: true, message: "Coin plans retrieved successfully.", total, data: plans });
  } catch (error) {
    console.error("Error in listCoinPlans:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//delete a coin plan
exports.deleteCoinPlan = async (req, res) => {
  try {
    const { coinPlanId } = req.query;
    if (!coinPlanId) return res.status(200).json({ status: false, message: "coinPlanId is required." });

    const plan = await CoinPlan.findByIdAndDelete(coinPlanId);
    if (!plan) return res.status(200).json({ status: false, message: "Coin plan not found." });

    return res.status(200).json({ status: true, message: "Coin plan deleted successfully." });
  } catch (error) {
    console.error("Error in deleteCoinPlan:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get coinplan histories of users (admin earning)
exports.getCoinPurchaseHistory = async (req, res) => {
  try {
    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const { startDate = "All", endDate = "All", userId, search } = req.query;

    const dateFilter = {};
    if (startDate !== "All" && endDate !== "All") {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const matchQuery = {
      ...dateFilter,
      type: 2,
      price: { $exists: true, $ne: 0 },
    };

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      matchQuery.userId = new mongoose.Types.ObjectId(userId);
    }

    const searchMatch = search
      ? {
          $or: [
            { "userDetails.nickName": { $regex: search, $options: "i" } },
            { "userDetails.fullName": { $regex: search, $options: "i" } },
            { "userDetails.uniqueId": { $regex: search, $options: "i" } },
          ],
        }
      : null;

    const [adminEarningsAgg, historyAgg] = await Promise.all([
      History.aggregate([{ $match: matchQuery }, { $group: { _id: null, total: { $sum: "$price" } } }]),
      History.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: "users",
            let: { uid: "$userId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
              {
                $project: {
                  nickName: 1,
                  fullName: 1,
                  uniqueId: 1,
                  profilePic: 1,
                },
              },
            ],
            as: "userDetails",
          },
        },
        { $unwind: "$userDetails" },

        ...(searchMatch ? [{ $match: searchMatch }] : []),

        {
          $group: {
            _id: "$userId",
            nickName: { $first: "$userDetails.nickName" },
            fullName: { $first: "$userDetails.fullName" },
            uniqueId: { $first: "$userDetails.uniqueId" },
            profilePic: { $first: "$userDetails.profilePic" },
            totalSpent: { $sum: "$price" },
            plansBought: { $sum: 1 },
            // records: { $push: { price: "$price", paymentGateway: "$paymentGateway", date: "$date", uniqueId: "$uniqueId" } },
          },
        },
        { $sort: { totalSpent: -1 } },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [{ $skip: (start - 1) * limit }, { $limit: limit }],
          },
        },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Coin purchase history retrieved successfully.",
      adminEarnings: adminEarningsAgg[0]?.total || 0,
      total: historyAgg[0]?.metadata[0]?.total || 0,
      data: historyAgg[0]?.data || [],
    });
  } catch (err) {
    console.error("getCoinPurchaseHistory error:", err);
    return res.status(500).json({ status: false, message: err.message || "Internal Server Error" });
  }
};
