const Listener = require("../../models/listener.model");

//mongoose
const mongoose = require("mongoose");

//fs
const fs = require("fs");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//import model
const Chat = require("../../models/chat.model");
const ChatTopic = require("../../models/chatTopic.model");
const History = require("../../models/history.model");
const Notification = require("../../models/notification.model");
const Rating = require("../../models/rating.model");
const ListenerMatchHistory = require("../../models/listenerMatchHistory.model");
const WithdrawalRecord = require("../../models/withdrawalRecord.model");
const User = require("../../models/user.model");

//path
const path = require("path");

//update profile
exports.modifyListenerProfile = async (req, res) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(req.query.listenerId);

    res.status(200).json({ status: true, message: "Listener profile updated successfully." });

    const [listener] = await Promise.all([Listener.findOne({ _id: listenerObjId })]);

    if (req.file) {
      const image = listener?.image?.split("storage");
      if (image) {
        const imagePath = "storage" + image[1];
        if (fs.existsSync(imagePath)) {
          const imageName = imagePath?.split("/")?.pop();
          if (imageName !== "male.png" && imageName !== "female.png") {
            fs.unlinkSync(imagePath);
          }
        }
      }

      listener.image = req.file.path;
    }

    listener.name = req.body.name ? req.body.name : listener.name;
    listener.nickName = req.body.nickName ? req.body.nickName : listener.nickName;
    listener.phoneNumber = req.body.phoneNumber ? req.body.phoneNumber : listener.phoneNumber;
    listener.selfIntro = req.body.selfIntro ? req.body.selfIntro : listener.selfIntro;
    listener.language = req.body.language ? req.body.language.split(",") : listener.language;
    listener.talkTopics = req.body.talkTopics ? req.body.talkTopics.split(",") : listener.talkTopics;
    listener.ratePrivateVideoCall = req.body.ratePrivateVideoCall ? Number(req.body.ratePrivateVideoCall) : listener.ratePrivateVideoCall;
    listener.ratePrivateAudioCall = req.body.ratePrivateAudioCall ? Number(req.body.ratePrivateAudioCall) : listener.ratePrivateAudioCall;
    listener.rateRandomVideoCall = req.body.rateRandomVideoCall ? Number(req.body.rateRandomVideoCall) : listener.rateRandomVideoCall;
    listener.rateRandomAudioCall = req.body.rateRandomAudioCall ? Number(req.body.rateRandomAudioCall) : listener.rateRandomAudioCall;
    await listener.save();
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update random call status
exports.toggleListenerCall = async (req, res, next) => {
  try {
    const { listenerId, field } = req.query;

    const allowedFields = ["isAvailableForPrivateAudioCall", "isAvailableForPrivateVideoCall", "isAvailableForRandomAudioCall", "isAvailableForRandomVideoCall", "isAvailableForChat"];

    if (!listenerId || !field) {
      return res.status(200).json({ status: false, message: "Missing required query parameters: listenerId and field." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId." });
    }

    if (!allowedFields.includes(field)) {
      return res.status(200).json({ status: false, message: `Invalid field. Allowed fields are: ${allowedFields.join(", ")}` });
    }

    const listener = await Listener.findById(listenerId).select(field);
    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener not found." });
    }

    const currentValue = listener[field];
    const updatedValue = !currentValue;

    await Listener.findByIdAndUpdate(listenerId, { [field]: updatedValue });

    return res.status(200).json({
      status: true,
      message: `Listener has been ${updatedValue ? "enabled" : "disabled"} for ${field}.`,
      data: { field, value: updatedValue },
    });
  } catch (error) {
    console.error("Error in toggleListenerCall:", error);
    return res.status(500).json({ status: false, message: "An error occurred while toggling the call availability." });
  }
};

//get profile
exports.fetchListenerProfile = async (req, res) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(req.query.listenerId);

    const [result] = await Listener.aggregate([
      { $match: { _id: listenerObjId } },
      {
        $project: {
          name: 1,
          nickName: 1,
          image: 1,
          selfIntro: 1,
          talkTopics: 1,
          language: 1,
          currentCoinBalance: 1,
          ratePrivateVideoCall: 1,
          ratePrivateAudioCall: 1,
          rateRandomVideoCall: 1,
          rateRandomAudioCall: 1,
          uniqueId: 1,
          rating: 1,
          experience: 1,
          callCount: 1,
          statusLabel: 1,
          isAvailableForPrivateAudioCall: 1,
          isAvailableForPrivateVideoCall: 1,
          isAvailableForRandomAudioCall: 1,
          isAvailableForRandomVideoCall: 1,
          isAvailableForChat: 1,
          isNotificationEnabled: 1,
          email: 1,
        },
      },
    ]);

    if (!result) {
      return res.status(200).json({ status: false, message: "Listener not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Listener profile fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("fetchListenerProfile error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//toggle listener notification permission
exports.updateNotifyPermission = async (req, res, next) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(listenerId);

    const listener = await Listener.findById(listenerObjId).select("_id isNotificationEnabled").lean();
    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener not found." });
    }

    const newAvailability = !listener.isNotificationEnabled;

    const updatedListener = await Listener.findByIdAndUpdate(listenerObjId, { isNotificationEnabled: newAvailability }, { new: true, select: "isNotificationEnabled" });

    if (!updatedListener) {
      return res.status(200).json({ status: false, message: "Failed to update notification permission." });
    }

    return res.status(200).json({
      status: true,
      message: `Notification permission has been ${newAvailability ? "enabled" : "disabled"} for the listener successfully.`,
    });
  } catch (error) {
    console.error("❌ Error toggling notification permission:", error);
    return res.status(500).json({ status: false, message: "An error occurred while updating notification permission." });
  }
};

//delete listener account
exports.deleteListenerAccount = async (req, res, next) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listener = await Listener.findOne({ _id: listenerId, isFake: false }).select("_id image identityProof").lean();
    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener not found." });
    }

    res.status(200).json({
      status: true,
      message: "Listener and related data successfully deleted.",
    });

    const [user, chats] = await Promise.all([User.findOne({ listenerId }).select("_id").lean(), Chat.find({ senderId: listenerId }).select("image audio").lean()]);

    if (user) {
      await User.updateOne({ _id: user._id }, { $set: { isListener: false, listenerId: null } });
    }

    if (chats.length > 0) {
      for (const chat of chats) {
        if (chat.image) {
          const image = chat?.image?.split("storage");
          if (image) {
            if (fs.existsSync("storage" + image[1])) {
              fs.unlinkSync("storage" + image[1]);
            }
          }
        }

        if (chat.audio) {
          const audio = chat?.audio?.split("storage");
          if (audio) {
            if (fs.existsSync("storage" + audio[1])) {
              fs.unlinkSync("storage" + audio[1]);
            }
          }
        }
      }
    }

    if (listener.image) {
      const filePath = path.join("storage", listener.image.split("storage")[1]);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    if (Array.isArray(listener.identityProof) && listener.identityProof.length > 0) {
      for (const identityProofUrl of listener.identityProof) {
        const identityProofPath = identityProofUrl?.split("storage");
        if (identityProofPath?.[1]) {
          const filePath = "storage" + identityProofPath[1];
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (error) {
              console.error(`Error deleting identityProof image: ${filePath}`, error);
            }
          }
        }
      }
    }

    await Promise.all([
      History.deleteMany({ listenerId }),
      Notification.deleteMany({ listenerId }),
      Rating.deleteMany({ listenerId }),
      ChatTopic.deleteMany({ $or: [{ senderId: listenerId }, { receiverId: listenerId }] }),
      Chat.deleteMany({ senderId: listenerId }),
      WithdrawalRecord.deleteMany({ listenerId }),
      ListenerMatchHistory.deleteMany({ lastListenerId: listenerId }),
    ]);

    await Listener.deleteOne({ _id: listenerId });
  } catch (error) {
    console.error("Error in deleteListenerAccount:", error);
    return res.status(500).json({ status: false, message: "An error occurred in deleteListenerAccount." });
  }
};

//get listener coin
exports.getListenerCoinBalance = async (req, res) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listener = await Listener.findById(listenerId).select("_id currentCoinBalance").lean();
    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener not found." });
    }

    return res.status(200).json({ status: true, message: "Listener coin balance retrieved successfully.", coin: listener.currentCoinBalance });
  } catch (error) {
    console.error("Error fetching listener coin balance:", error);
    return res.status(500).json({ status: false, message: "An error occurred while retrieving user coin balance.", error: error.message });
  }
};

//get user's profile
exports.getProfileByUserId = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.query.userId);

    const [user] = await Promise.all([User.findOne({ _id: userId }).select("nickName fullName birthDate gender bio age profilePic email countryFlag country uniqueId isOnline").lean()]);

    return res.status(200).json({ status: true, message: "The user has retrieved their profile.", user: user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
