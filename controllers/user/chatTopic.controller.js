const ChatTopic = require("../../models/chatTopic.model");

//mongoose
const mongoose = require("mongoose");

//search listener (chat)
exports.findChattedListenersBySearch = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const searchString = req.query.searchString?.trim();
    if (!searchString) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const listeners = await ChatTopic.aggregate([
      {
        $match: {
          chatId: { $ne: null },
          $or: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      {
        $project: {
          chatId: 1,
          otherUserId: {
            $cond: [{ $eq: ["$senderId", userId] }, "$receiverId", "$senderId"],
          },
        },
      },
      {
        $group: {
          _id: "$otherUserId",
          chatIds: { $addToSet: "$chatId" },
        },
      },
      {
        $lookup: {
          from: "listeners",
          localField: "_id",
          foreignField: "_id",
          as: "listener",
        },
      },
      { $unwind: "$listener" },
      {
        $match: {
          "listener.isBlock": false,
          ...(searchString !== "All"
            ? {
                $or: [{ "listener.name": { $regex: searchString, $options: "i" } }, { "listener.nickName": { $regex: searchString, $options: "i" } }],
              }
            : {}),
        },
      },
      {
        $lookup: {
          from: "chats",
          let: { chatIds: "$chatIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$chatIds"],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                message: 1,
                messageType: 1,
                createdAt: 1,
              },
            },
          ],
          as: "lastMessage",
        },
      },
      { $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          chatUserId: "$_id",
          name: "$listener.name",
          nickName: "$listener.nickName",
          image: "$listener.image",
          isOnline: "$listener.isOnline",
          ratePrivateVideoCall: "$listener.ratePrivateVideoCall",
          isAvailableForPrivateAudioCall: "$listener.isAvailableForPrivateAudioCall",
          isAvailableForPrivateVideoCall: "$listener.isAvailableForPrivateVideoCall",
          isAvailableForRandomVideoCall: "$listener.isAvailableForRandomVideoCall",
          isAvailableForRandomAudioCall: "$listener.isAvailableForRandomAudioCall",
          isAvailableForChat: "$listener.isAvailableForChat",
          video: "$listener.video",
          audio: "$listener.audio",
          isFake: "$listener.isFake",
          lastMessage: { $ifNull: ["$lastMessage.message", ""] },
          messageTime: { $ifNull: ["$lastMessage.createdAt", ""] },
        },
      },
      { $sort: { messageTime: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json({
      status: true,
      message: listeners.length ? "Success" : "No data found.",
      data: listeners,
    });
  } catch (error) {
    console.error("Error fetching chatted listeners:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get chat thumb list
exports.getUserChatList = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized: Token missing or invalid." });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const chatList = await ChatTopic.aggregate([
      {
        $match: {
          chatId: { $ne: null },
          $or: [{ senderId: userObjectId }, { receiverId: userObjectId }],
        },
      },
      {
        $addFields: {
          receiverId: {
            $cond: {
              if: { $eq: ["$senderId", userObjectId] },
              then: "$receiverId",
              else: "$senderId",
            },
          },
        },
      },
      {
        $lookup: {
          from: "listeners",
          localField: "receiverId",
          foreignField: "_id",
          as: "listener",
        },
      },
      { $unwind: { path: "$listener", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "chats",
          localField: "chatId",
          foreignField: "_id",
          as: "chat",
        },
      },
      { $unwind: { path: "$chat", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "chats",
          let: { topicId: "$chat.chatTopicId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$chatTopicId", "$$topicId"] }, { $eq: ["$isRead", false] }, { $ne: ["$senderId", userObjectId] }],
                },
              },
            },
            { $count: "unreadCount" },
          ],
          as: "unreads",
        },
      },
      {
        $addFields: {
          unreadCount: {
            $cond: [{ $gt: [{ $size: "$unreads" }, 0] }, { $arrayElemAt: ["$unreads.unreadCount", 0] }, 0],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          receiverId: { $first: "$receiverId" },
          name: { $first: "$listener.name" },
          image: { $first: "$listener.image" },
          isOnline: { $first: "$listener.isOnline" },
          ratePrivateVideoCall: { $first: "$listener.ratePrivateVideoCall" },
          ratePrivateAudioCall: { $first: "$listener.ratePrivateAudioCall" },
          video: { $first: "$listener.video" },
          audio: { $first: "$listener.audio" },
          isFake: { $first: "$listener.isFake" },
          isAvailableForPrivateAudioCall: { $first: "$listener.isAvailableForPrivateAudioCall" },
          isAvailableForPrivateVideoCall: { $first: "$listener.isAvailableForPrivateVideoCall" },
          isAvailableForRandomAudioCall: { $first: "$listener.isAvailableForRandomAudioCall" },
          isAvailableForRandomVideoCall: { $first: "$listener.isAvailableForRandomVideoCall" },
          isAvailableForChat: { $first: "$listener.isAvailableForChat" },
          chatTopicId: { $first: "$chat.chatTopicId" },
          senderId: { $first: "$chat.senderId" },
          messageType: { $first: "$chat.messageType" },
          message: { $first: "$chat.message" },
          lastChatMessageTime: { $first: "$chat.createdAt" },
          unreadCount: { $first: "$unreadCount" },
        },
      },
      {
        $project: {
          receiverId: 1,
          name: 1,
          image: 1,
          isOnline: 1,
          ratePrivateVideoCall: 1,
          ratePrivateAudioCall: 1,
          video: 1,
          audio: 1,
          isFake: 1,
          isAvailableForPrivateAudioCall: 1,
          isAvailableForPrivateVideoCall: 1,
          isAvailableForRandomAudioCall: 1,
          isAvailableForRandomVideoCall: 1,
          isAvailableForChat: 1,
          chatTopicId: 1,
          senderId: 1,
          messageType: 1,
          message: 1,
          unreadCount: 1,
          lastChatMessageTime: 1,
          time: {
            $let: {
              vars: {
                messageDay: {
                  $dateToString: { format: "%Y-%m-%d", date: "$lastChatMessageTime" },
                },
                today: {
                  $dateToString: { format: "%Y-%m-%d", date: new Date() },
                },
                yesterday: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  },
                },
                dayOfWeek: {
                  $dayOfWeek: "$lastChatMessageTime",
                },
              },
              in: {
                $cond: [
                  { $eq: ["$$messageDay", "$$today"] },
                  "Today",
                  {
                    $cond: [
                      { $eq: ["$$messageDay", "$$yesterday"] },
                      "Yesterday",
                      {
                        $switch: {
                          branches: [
                            { case: { $eq: ["$$dayOfWeek", 1] }, then: "Sunday" },
                            { case: { $eq: ["$$dayOfWeek", 2] }, then: "Monday" },
                            { case: { $eq: ["$$dayOfWeek", 3] }, then: "Tuesday" },
                            { case: { $eq: ["$$dayOfWeek", 4] }, then: "Wednesday" },
                            { case: { $eq: ["$$dayOfWeek", 5] }, then: "Thursday" },
                            { case: { $eq: ["$$dayOfWeek", 6] }, then: "Friday" },
                            { case: { $eq: ["$$dayOfWeek", 7] }, then: "Saturday" },
                          ],
                          default: "Unknown Day",
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      { $sort: { lastChatMessageTime: -1 } },
      { $skip: (start - 1) * limit },
      { $limit: limit },
    ]);

    return res.status(200).json({
      status: true,
      message: "Chat list fetched successfully.",
      chatList,
    });
  } catch (error) {
    console.error("Error fetching chat list:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong while fetching chat list.",
      error: error.message,
    });
  }
};
