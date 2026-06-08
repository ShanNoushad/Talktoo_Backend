const Chat = require("../../models/chat.model");

//import model
const ChatTopic = require("../../models/chatTopic.model");
const User = require("../../models/user.model");
const Listener = require("../../models/listener.model");
const Notification = require("../../models/notification.model");

//mongoose
const mongoose = require("mongoose");

//private key
const admin = require("../../util/privateKey");

//deletefile
const { deleteFiles } = require("../../util/deletefile");

//send message ( image or audio )
exports.sendChatMessage = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { chatTopicId, receiverId, messageType } = req.body;

    if (!chatTopicId || !receiverId || !messageType || !req.files) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Invalid request parameters." });
    }

    const senderId = new mongoose.Types.ObjectId(req.user.userId);
    const receiverObjId = new mongoose.Types.ObjectId(receiverId);
    const chatTopicObjId = new mongoose.Types.ObjectId(chatTopicId);
    const msgType = Number(messageType);

    const [sender, receiver, chatTopic] = await Promise.all([
      User.findById(senderId).select("fullName isOnline coin profilePic").lean(),
      Listener.findOne({ _id: receiverObjId, isBlock: false }).select("fcmToken isBlock isNotificationEnabled").lean(),
      ChatTopic.findById(chatTopicObjId).select("_id chatId").lean(),
    ]);

    if (!sender || !receiver || !chatTopic) {
      if (req.files) deleteFiles(req.files);
      const errorMessage = !sender ? "Sender not found." : !receiver ? "Receiver not found or blocked." : "Chat topic not found.";
      return res.status(200).json({ status: false, message: errorMessage });
    }

    const chat = new Chat();
    chat.senderId = sender._id;

    if (msgType == 2) {
      if (!req.files.image) {
        if (req.files) deleteFiles(req.files);
        return res.status(200).json({ status: false, message: "Image file is required." });
      }

      chat.messageType = 2;
      chat.message = "📸 Image";
      chat.image = req?.files?.image ? req?.files?.image[0].path : "";
    } else if (msgType == 3) {
      if (!req.files.audio) {
        if (req.files) deleteFiles(req.files);
        return res.status(200).json({ status: false, message: "Audio file is required." });
      }

      chat.messageType = 3;
      chat.message = "🎤 Audio";
      chat.audio = req?.files?.audio ? req?.files?.audio[0].path : "";
    } else {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "messageType must be passed valid." });
    }

    chat.chatTopicId = chatTopic._id;
    chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    await Promise.all([chat.save(), ChatTopic.updateOne({ _id: chatTopicObjId }, { $set: { chatId: chat._id } })]);

    res.status(200).json({
      status: true,
      message: "Message sent successfully.",
      chat: chat,
    });

    if (receiver.isNotificationEnabled && !receiver.isBlock && receiver.fcmToken !== null) {
      const payload = {
        token: receiver.fcmToken,
        data: {
          title: `${sender.name} sent you a message 📩`,
          body: `🗨️ ${chat.message}`,
          type: "CHAT",
          senderId: String(sender?._id ?? ""),
          name: String(sender?.fullName ?? ""),
          profilePic: String(sender?.profilePic ?? ""),
          isOnline: String(sender?.isOnline ?? false),
          ratePrivateAudioCall: String(""),
          ratePrivateVideoCall: String(""),
          video: JSON.stringify([]),
          isFake: String(false),
        },
      };

      const adminPromise = await admin;
      adminPromise
        .messaging()
        .send(payload)
        .then(async (response) => {
          console.log("Successfully sent with response: ", response);

          const notification = new Notification();
          notification.listenerId = receiver._id;
          notification.title = `${sender.name} sent you a message 📩`;
          notification.message = `🗨️ ${chat.message}`;
          notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          await notification.save();
        })
        .catch((error) => {
          console.log("Error sending message:      ", error);
        });
    }
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get old chat
exports.retrieveChatHistory = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { receiverId, start = 1, limit = 20 } = req.query;

    if (!receiverId) {
      return res.status(200).json({ status: false, message: "Receiver ID is required." });
    }

    const senderId = new mongoose.Types.ObjectId(req.user.userId);
    const receiverObjId = new mongoose.Types.ObjectId(req.query.receiverId);
    const page = parseInt(start);
    const pageSize = parseInt(limit);

    const [receiver, chatTopic] = await Promise.all([
      Listener.findOne({ _id: receiverObjId, isBlock: false }).select("_id").lean(),
      ChatTopic.findOne({
        $or: [
          { senderId, receiverId: receiverObjId },
          { senderId: receiverObjId, receiverId: senderId },
        ],
      }).select("_id"),
    ]);

    if (!receiver) {
      return res.status(200).json({ status: false, message: "Receiver not found or blocked." });
    }

    let topic = chatTopic;
    if (!topic) {
      topic = await new ChatTopic({ senderId, receiverId: receiverObjId }).save();
    }

    const [_, __, chatHistory] = await Promise.all([
      Chat.updateMany({ chatTopicId: topic._id, isRead: false }, { $set: { isRead: true } }),
      ChatTopic.updateOne({ _id: topic._id }, { $setOnInsert: { createdAt: new Date() } }),
      Chat.find({ chatTopicId: topic._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Chat history retrieved successfully.",
      chatTopicId: topic._id,
      chat: chatHistory,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
