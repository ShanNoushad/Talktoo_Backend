const Notification = require("../../models/notification.model");

//mongoose
const mongoose = require("mongoose");

//get notification list
exports.getNotificationHistory = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId. It must be a valid MongoDB ObjectId." });
    }

    const { start = 1, limit = 20 } = req.query || {};
    const pageNumber = Math.max(parseInt(start, 10), 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const userObjId = new mongoose.Types.ObjectId(req.user.userId);

    const [notifications] = await Promise.all([Notification.find({ userId: userObjId }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).select("-__v").lean()]);

    return res.status(200).json({
      status: true,
      message: "Retrieve the notification list.",
      notification: notifications,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//clear all notification
exports.clearNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId. It must be a valid MongoDB ObjectId." });
    }

    const userObjId = new mongoose.Types.ObjectId(req.user.userId);

    const [clearNotificationHistory] = await Promise.all([Notification.deleteMany({ userId: userObjId }).lean()]);

    if (clearNotificationHistory.deletedCount > 0) {
      return res.status(200).json({
        status: true,
        message: "Successfully cleared all Notification history.",
      });
    } else {
      return res.status(200).json({
        status: false,
        message: "Notification history not found.",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
