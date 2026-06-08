//fs
const fs = require("fs");

//path
const path = require("path");

//private key
const admin = require("../util/privateKey");

//import model
const User = require("../models/user.model");
const History = require("../models/history.model");
const Listener = require("../models/listener.model");
const ListenerMatchHistory = require("../models/listenerMatchHistory.model");
const Notification = require("../models/notification.model");
const Rating = require("../models/rating.model");
const Chat = require("../models/chat.model");
const ChatTopic = require("../models/chatTopic.model");
const WithdrawalRecord = require("../models/withdrawalRecord.model");

const mongoose = require("mongoose");

//Helper function to delete all data associated with a userId
const deleteUserDataById = async (userId, user) => {
  const excludedListenerIds = [new mongoose.Types.ObjectId("691822c8ea0bbcd6eaa74bdc")];

  const listener = await Listener.findOne({
    userId,
    isFake: false,
    _id: { $nin: excludedListenerIds },
  })
    .select("_id image identityProof")
    .lean();

  const listenerId = listener?._id; // single listener

  const chatFilter = listenerId ? { senderId: { $in: [userId, listenerId] } } : { senderId: userId };
  const chats = await Chat.find(chatFilter).select("image audio").lean();

  for (const chat of chats) {
    if (chat.image) {
      const imagePath = chat.image.split("storage")[1];
      if (imagePath) {
        const fullPath = "storage" + imagePath;
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    }

    if (chat.audio) {
      const audioPath = chat.audio.split("storage")[1];
      if (audioPath) {
        const fullPath = "storage" + audioPath;
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    }
  }

  await Promise.all([
    Chat.deleteMany(chatFilter),
    ChatTopic.deleteMany(
      listenerId
        ? {
            $or: [
              { senderId: userId, receiverId: listenerId },
              { senderId: listenerId, receiverId: userId },
            ],
          }
        : { senderId: userId }
    ),
    History.deleteMany(listenerId ? { $or: [{ userId }, { listenerId }] } : { userId }),
    Notification.deleteMany(listenerId ? { $or: [{ userId }, { listenerId }] } : { userId }),
    Rating.deleteMany(listenerId ? { $or: [{ userId }, { listenerId }] } : { userId }),
    ListenerMatchHistory.deleteMany(listenerId ? { $or: [{ userId }, { listenerId }] } : { userId }),
  ]);

  if (listener) {
    if (listener.image) {
      const imgPath = listener.image.split("storage")[1];
      if (imgPath) {
        const filePath = path.join("storage", imgPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    if (Array.isArray(listener.identityProof)) {
      for (const proof of listener.identityProof) {
        const proofPath = proof?.split("storage")[1];
        if (proofPath) {
          const fullPath = "storage" + proofPath;
          if (fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
            } catch (err) {
              console.error("Error deleting identity proof:", fullPath, err);
            }
          }
        }
      }
    }

    await Promise.all([WithdrawalRecord.deleteMany({ listenerId: listener._id }), ListenerMatchHistory.deleteMany({ lastListenerId: listener._id }), Listener.findByIdAndDelete(listener._id)]);
  }

  if (user.profilePic && user.profilePic.includes("storage")) {
    const imagePath = path.join(__dirname, user.profilePic);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log("Profile picture deleted:", imagePath);
    }
  }

  if (user.firebaseId) {
    try {
      const adminPromise = await admin;
      await adminPromise.auth().deleteUser(user.firebaseId);
      console.log(`✅ Firebase user deleted: ${user.firebaseId}`);
    } catch (err) {
      console.error(`❌ Failed to delete Firebase user ${user.firebaseId}:`, err.message);
    }
  }

  await User.findByIdAndDelete(userId);
};

module.exports = deleteUserDataById;
