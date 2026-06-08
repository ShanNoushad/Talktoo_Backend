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
exports.dispatchChatMessage = async (req, res) => {
  try {
    const { senderId, chatTopicId, receiverId, messageType } = req.body;

    if (!senderId || !chatTopicId || !receiverId || !messageType) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops! Invalid details." });
    }

    const messageTypeNum = Number(messageType);
    if (![2, 3].includes(messageTypeNum)) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Invalid messageType." });
    }

    if (messageTypeNum === 2 && (!req.files?.image || req.files.image.length === 0)) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Image file is required for messageType 2." });
    }

    if (messageTypeNum === 3 && (!req.files?.audio || req.files.audio.length === 0)) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Audio file is required for messageType 3." });
    }

    const [sender, receiver, chatTopic] = await Promise.all([
      Listener.findOne({ _id: senderId, isBlock: false }).select("name isOnline image ratePrivateAudioCall ratePrivateVideoCall video isFake").lean(),
      User.findOne({ _id: receiverId, isBlock: false }).select("fcmToken isBlock isNotificationEnabled").lean(),
      ChatTopic.findById(chatTopicId).select("_id chatId").lean(),
    ]);

    if (!sender || !receiver || !chatTopic) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Sender, Receiver, or ChatTopic not found." });
    }

    const chat = new Chat({
      senderId,
      messageType: messageTypeNum,
      chatTopicId: chatTopic._id,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    if (messageTypeNum === 2) {
      chat.message = "📸 Image";
      chat.image = req.files.image[0].path;
    } else if (messageTypeNum === 3) {
      chat.message = "🎤 Audio";
      chat.audio = req.files.audio[0].path;
    }

    await Promise.all([chat.save(), ChatTopic.updateOne({ _id: chatTopic._id }, { $set: { chatId: chat._id } })]);

    res.status(200).json({ status: true, message: "Message sent successfully.", chat });

    if (receiver.isNotificationEnabled && !receiver.isBlock && receiver.fcmToken !== null) {
      const payload = {
        token: receiver.fcmToken,
        data: {
          title: `${sender.name} sent you a message 📩`,
          body: `🗨️ ${chat.message}`,
          type: "CHAT",
          senderId: String(sender?._id || ""),
          name: String(sender?.name) || "",
          profilePic: String(sender?.image) || "",
          isOnline: String(sender?.isOnline || false),
          ratePrivateAudioCall: String(sender?.ratePrivateAudioCall || ""),
          ratePrivateVideoCall: String(sender?.ratePrivateVideoCall || ""),
          video: JSON.stringify(sender?.video || []),
          isFake: String(sender?.isFake ?? false),
        },
      };

      const adminPromise = await admin;
      adminPromise
        .messaging()
        .send(payload)
        .then(async (response) => {
          console.log("Successfully sent with response: ", response);

          const notification = new Notification();
          notification.userId = receiver._id;
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
    console.error("submitChatMessage error:", error);
    res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get old chat
exports.getChatHistory = async (req, res) => {
  try {
    const { senderId, receiverId, start = 1, limit = 20 } = req.query;

    if (!senderId || !receiverId) {
      return res.status(200).json({ status: false, message: "Oops! Invalid senderId or receiverId." });
    }

    const startInt = parseInt(start);
    const limitInt = parseInt(limit);

    const [receiver, chatTopic] = await Promise.all([
      User.findOne({ _id: receiverId, isBlock: false }).select("_id").lean(),
      ChatTopic.findOne({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      })
        .select("_id")
        .lean(),
    ]);

    if (!receiver) {
      return res.status(200).json({ status: false, message: "Receiver not found." });
    }

    let chatTopicId;
    if (!chatTopic) {
      const newChatTopic = await new ChatTopic({ senderId, receiverId: receiver._id }).save();
      chatTopicId = newChatTopic._id;
    } else {
      chatTopicId = chatTopic._id;
    }

    const [_, __, chatHistory] = await Promise.all([
      Chat.updateMany({ chatTopicId, isRead: false }, { $set: { isRead: true } }),
      ChatTopic.updateOne({ _id: chatTopicId }, { updatedAt: new Date() }),
      Chat.find({ chatTopicId })
        .sort({ createdAt: -1 })
        .skip((startInt - 1) * limitInt)
        .limit(limitInt)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Chat history retrieved successfully.",
      chatTopic: chatTopicId,
      chat: chatHistory,
    });
  } catch (error) {
    console.error("Error retrieving chat history:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
