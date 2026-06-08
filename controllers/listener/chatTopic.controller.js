const ChatTopic = require("../../models/chatTopic.model");

//import model
const User = require("../../models/user.model");

//mongoose
const mongoose = require("mongoose");

//search user (chat)
exports.searchChattedUsers = async (req, res) => {
  try {
    if (!req.query.listenerId) {
      return res.status(200).json({ status: false, message: "Listener ID is missing or invalid." });
    }

    const searchString = req.query.searchString?.trim();
    if (!searchString) {
      return res.status(200).json({ status: false, message: "Invalid search string." });
    }

    const listenerId = new mongoose.Types.ObjectId(req.query.listenerId);

    const users = await ChatTopic.aggregate([
      {
        $match: {
          chatId: { $ne: null },
          $or: [{ senderId: listenerId }, { receiverId: listenerId }],
        },
      },
      {
        $project: {
          chatId: 1,
          otherUserId: {
            $cond: [{ $eq: ["$senderId", listenerId] }, "$receiverId", "$senderId"],
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
          from: "users",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
            {
              $project: {
                nickName: 1,
                fullName: 1,
                profilePic: 1,
                isOnline: 1,
                isBlock: 1,
              },
            },
          ],
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $match: {
          "user.isBlock": false,
          ...(searchString !== "All"
            ? {
                $or: [{ "user.fullName": { $regex: searchString, $options: "i" } }, { "user.nickName": { $regex: searchString, $options: "i" } }],
              }
            : {}),
        },
      },
      {
        $lookup: {
          from: "chats",
          let: { chatIds: "$chatIds" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$chatIds"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                message: 1,
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
          nickName: "$user.nickName",
          fullName: "$user.fullName",
          profilePic: "$user.profilePic",
          isOnline: "$user.isOnline",
          lastMessage: "$lastMessage.message",
          messageTime: "$lastMessage.createdAt",
        },
      },
      { $sort: { messageTime: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json({
      status: true,
      message: users.length ? "Success" : "No data found.",
      data: users,
    });
  } catch (error) {
    console.error("Error in searchChattedUsers:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get chat thumb list
exports.getChatList = async (req, res) => {
  try {
    if (!req.query.listenerId || !mongoose.Types.ObjectId.isValid(req.query.listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid or missing listenerId." });
    }

    const listenerObjectId = new mongoose.Types.ObjectId(req.query.listenerId);
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const [chatList] = await Promise.all([
      ChatTopic.aggregate([
        {
          $match: {
            chatId: { $ne: null },
            $or: [{ senderId: listenerObjectId }, { receiverId: listenerObjectId }],
          },
        },
        {
          $addFields: {
            userId: {
              $cond: {
                if: { $eq: ["$senderId", listenerObjectId] },
                then: "$receiverId",
                else: "$senderId",
              },
            },
          },
        },
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
                  profilePic: 1,
                  isOnline: 1,
                },
              },
            ],
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: "chats",
            let: { chatId: "$chatId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$chatId"] } } },
              {
                $project: {
                  chatTopicId: 1,
                  senderId: 1,
                  message: 1,
                  messageType: 1,
                  createdAt: 1,
                },
              },
            ],
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
                    $and: [{ $eq: ["$chatTopicId", "$$topicId"] }, { $eq: ["$isRead", false] }, { $ne: ["$senderId", listenerObjectId] }],
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
            _id: "$userId",
            userId: { $first: "$userId" },
            nickName: { $first: "$user.nickName" },
            fullName: { $first: "$user.fullName" },
            profilePic: { $first: "$user.profilePic" },
            isOnline: { $first: "$user.isOnline" },
            chatTopicId: { $first: "$chat.chatTopicId" },
            senderId: { $first: "$chat.senderId" },
            message: { $first: "$chat.message" },
            messageType: { $first: "$chat.messageType" },
            lastChatMessageTime: { $first: "$chat.createdAt" },
            unreadCount: { $first: "$unreadCount" },
          },
        },
        {
          $project: {
            userId: 1,
            nickName: 1,
            fullName: 1,
            profilePic: 1,
            isOnline: 1,
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
                            default: "Unknown day",
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
      ]),
    ]);

    return res.status(200).json({ status: true, message: "Success", chatList });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
