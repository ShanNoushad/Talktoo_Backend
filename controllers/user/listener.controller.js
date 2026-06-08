const Listener = require("../../models/listener.model");

//mongoose
const mongoose = require("mongoose");

//unique Id
const generateUniqueId = require("../../util/generateUniqueId");

//private key
const admin = require("../../util/privateKey");

//import model
const ListenerMatchHistory = require("../../models/listenerMatchHistory.model");
const Notification = require("../../models/notification.model");
const User = require("../../models/user.model");

//become a listener
exports.initiateListenerRequest = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    //Fetch settings to check if they are allowed to become a listener
    const userSettings = settingJSON;
    if (!userSettings || !userSettings.allowBecomeHostOption) {
      return res.status(200).json({ status: false, message: "You are not allowed to become a listener." });
    }

    const { email, fcmToken, name, nickName, age, selfIntro, talkTopics, language, experience, location, identityProofType, gender, country } = req.body;

    if (!email || !age || !location || !fcmToken || !name || !nickName || !selfIntro || !talkTopics || !language || !identityProofType || !experience || !req.files) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const [user, uniqueId, existingListener, declineListenerRequest] = await Promise.all([
      User.findOne({ _id: userId }).select("_id phoneNumber").lean(),
      generateUniqueId(),
      Listener.findOne({ status: 1, userId: userId }).select("_id").lean(),
      Listener.findOne({ status: 3, userId: userId }).select("_id").lean(),
    ]);

    if (existingListener) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops! A listener request already exists." });
    }

    res.status(200).json({
      status: true,
      message: "Listener request successfully sent.",
    });

    if (declineListenerRequest) {
      await Listener.findByIdAndDelete(declineListenerRequest);
    }

    const talkTopicArray = typeof talkTopics === "string" ? talkTopics.split(",").map((topic) => topic.trim()) : [];
    const languages = typeof language === "string" ? language.split(",").map((lang) => lang.trim()) : [];

    const newListener = new Listener({
      email,
      name,
      nickName,
      selfIntro,
      talkTopics: talkTopicArray,
      language: languages,
      gender: gender.trim().toLowerCase() || "",
      country: country.trim().toLowerCase() || "",
      age: age || 18,
      experience,
      location: location.trim().toLowerCase() || "",
      image: req.files.image ? req.files.image[0].path : "",
      identityProofType,
      identityProof: req.files.identityProof?.map((file) => file.path) || [],
      fcmToken,
      userId,
      uniqueId,
      phoneNumber: user?.phoneNumber || "",
      status: 1,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    await newListener.save();

    if (fcmToken && fcmToken !== null) {
      const payload = {
        token: fcmToken,
        data: {
          title: "🎙️ Listener Application Received 🚀",
          body: "Thank you for applying as a listener! Our team is reviewing your request, and we'll update you soon. Stay tuned! 🤝✨",
        },
      };

      try {
        const adminInstance = await admin;
        await adminInstance.messaging().send(payload);
        console.log("Notification sent successfully.");

        const notification = new Notification();
        notification.userId = userId;
        notification.title = `🎙️ Listener Application Received 🚀`;
        notification.message = `Thank you for applying as a listener! Our team is reviewing your request, and we'll update you soon. Stay tuned! 🤝✨`;
        notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        await notification.save();
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//check the status of a listener request
exports.verifyListenerRequestStatus = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const listener = await Listener.findOne({ userId: userId }).select("name image uniqueId email selfIntro status reason location date").lean();
    if (!listener) {
      return res.status(200).json({ status: false, message: "Request not found for that user!" });
    }

    return res.status(200).json({
      status: true,
      message: "Request status retrieved successfully",
      data: listener,
    });
  } catch (error) {
    console.error("Error fetching request status:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get listener list
exports.fetchFilteredListeners = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { start = 1, limit = 20, language, talkTopic, searchString = "" } = req.query;

    const parsedStart = parseInt(start);
    const parsedLimit = parseInt(limit);
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const languageArray = typeof language === "string" ? (language === "All" ? [] : language.split(",")) : Array.isArray(language) ? language : [];
    const topicArray = typeof talkTopic === "string" ? (talkTopic === "All" ? [] : talkTopic.split(",")) : Array.isArray(talkTopic) ? talkTopic : [];

    const matchConditions = [{ isBlock: false }, { status: 2 }, { userId: { $ne: userId } }];

    if (settingJSON.isDemoContentEnabled) {
      // Include both real and fake listeners
      matchConditions.push({ isFake: { $in: [false, true] } });
    } else {
      // Only include real listeners (fake listeners are excluded)
      matchConditions.push({ isFake: false });
    }

    if (languageArray.length > 0) {
      matchConditions.push({ language: { $in: languageArray } });
    }

    if (topicArray.length > 0) {
      matchConditions.push({ talkTopics: { $in: topicArray } });
    }

    if (searchString && searchString !== "All") {
      const regex = new RegExp(searchString, "i");
      matchConditions.push({
        $or: [{ name: regex }, { uniqueId: regex }, { language: regex }, { talkTopics: regex }],
      });
    }

    const result = await Listener.aggregate([
      { $match: { $and: matchConditions } },
      {
        $addFields: {
          statusLabel: {
            $cond: [
              { $eq: ["$isFake", true] },
              // If fake listener, randomly pick a status
              {
                $arrayElemAt: [["Available", "On Call", "Offline"], { $floor: { $multiply: [{ $rand: {} }, 3] } }],
              },
              // If real listener, use the existing logic for status
              {
                $cond: [
                  {
                    $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", false] }, { $eq: ["$callId", null] }],
                  },
                  "Available",
                  {
                    $cond: [
                      {
                        $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }, { $ne: ["$callId", null] }],
                      },
                      "On Call",
                      "Offline",
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          name: 1,
          image: 1,
          talkTopics: 1,
          language: 1,
          age: 1,
          ratePrivateVideoCall: 1,
          ratePrivateAudioCall: 1,
          rateRandomVideoCall: 1,
          rateRandomAudioCall: 1,
          rating: 1,
          experience: 1,
          statusLabel: 1,
          callCount: 1,
          video: 1,
          audio: 1,
          isFake: 1,
          uniqueId: 1,
          isAvailableForPrivateAudioCall: 1,
          isAvailableForPrivateVideoCall: 1,
          isAvailableForRandomVideoCall: 1,
          isAvailableForRandomAudioCall: 1,
          isAvailableForChat: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (parsedStart - 1) * parsedLimit },
      { $limit: parsedLimit },
    ]);

    return res.status(200).json({
      status: true,
      message: "Listeners fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("fetchFilteredListeners error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get top listener list
exports.fetchTopListeners = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { start = 1, limit = 20, searchString = "" } = req.query;

    const parsedStart = parseInt(start);
    const parsedLimit = parseInt(limit);
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const matchConditions = [{ isBlock: false }, { status: 2 }, { userId: { $ne: userId } }];

    if (settingJSON.isDemoContentEnabled) {
      // Include both real and fake listeners
      matchConditions.push({ isFake: { $in: [false, true] } });
    } else {
      // Only include real listeners (fake listeners are excluded)
      matchConditions.push({ isFake: false });
    }

    if (searchString && searchString !== "All") {
      const regex = new RegExp(searchString, "i");
      matchConditions.push({
        $or: [{ name: regex }, { uniqueId: regex }, { language: regex }, { talkTopics: regex }],
      });
    }

    const result = await Listener.aggregate([
      { $match: { $and: matchConditions } },
      {
        $addFields: {
          statusLabel: {
            $cond: [
              { $eq: ["$isFake", true] },
              // If fake listener, randomly pick a status
              {
                $arrayElemAt: [["Available", "On Call", "Offline"], { $floor: { $multiply: [{ $rand: {} }, 3] } }],
              },
              // If real listener, use the existing logic for status
              {
                $cond: [
                  {
                    $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", false] }, { $eq: ["$callId", null] }],
                  },
                  "Available",
                  {
                    $cond: [
                      {
                        $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }, { $ne: ["$callId", null] }],
                      },
                      "On Call",
                      "Offline",
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          name: 1,
          image: 1,
          age: 1,
          talkTopics: 1,
          language: 1,
          ratePrivateVideoCall: 1,
          ratePrivateAudioCall: 1,
          rateRandomVideoCall: 1,
          rateRandomAudioCall: 1,
          rating: 1,
          experience: 1,
          statusLabel: 1,
          callCount: 1,
          isOnline: 1,
          video: 1,
          audio: 1,
          isFake: 1,
          uniqueId: 1,
          isAvailableForPrivateAudioCall: 1,
          isAvailableForPrivateVideoCall: 1,
          isAvailableForRandomVideoCall: 1,
          isAvailableForRandomAudioCall: 1,
          isAvailableForChat: 1,
          totalCoins: 1,
          createdAt: 1,
        },
      },
      {
        $sort: {
          isOnline: -1,
          rating: -1,
          totalCoins: -1,
          createdAt: -1,
        },
      }, // Sort by multiple factors: rating > totalCoins > createdAt
      { $skip: (parsedStart - 1) * parsedLimit },
      { $limit: parsedLimit },
    ]);

    return res.status(200).json({
      status: true,
      message: "Listeners fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("getFilteredListeners error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get listener profile
exports.getListenerProfile = async (req, res) => {
  try {
    if (!req.query.listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(req.query.listenerId);

    const [result] = await Listener.aggregate([
      { $match: { _id: listenerObjId } },
      {
        $addFields: {
          statusLabel: {
            $cond: [
              {
                $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", false] }, { $eq: ["$callId", null] }],
              },
              "Available",
              {
                $cond: [
                  {
                    $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }, { $ne: ["$callId", null] }],
                  },
                  "On Call",
                  "Offline",
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          name: 1,
          image: 1,
          selfIntro: 1,
          talkTopics: 1,
          language: 1,
          ratePrivateVideoCall: 1,
          ratePrivateAudioCall: 1,
          rateRandomVideoCall: 1,
          rateRandomAudioCall: 1,
          rating: 1,
          experience: 1,
          callCount: 1,
          statusLabel: 1,
          totalCoins: 1,
          video: 1,
          isFake: 1,
          age: 1,
          email: 1,
          uniqueId: 1,
          isAvailableForPrivateAudioCall: 1,
          isAvailableForPrivateVideoCall: 1,
          isAvailableForRandomVideoCall: 1,
          isAvailableForRandomAudioCall: 1,
          isAvailableForChat: 1,
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      message: "Listener profile fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("getListenerProfile error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get available listner
exports.retrieveAvailableListener = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Valid userId is required." });
    }

    const { callType, callMode } = req.query;

    const validCallTypes = ["audio", "video"];
    const validCallModes = ["private", "random"];

    if (!validCallTypes.includes(callType)) {
      return res.status(200).json({ status: false, message: "Invalid callType. Must be 'audio' or 'video'." });
    }

    if (!validCallModes.includes(callMode)) {
      return res.status(200).json({ status: false, message: "Invalid callMode. Must be 'private' or 'random'." });
    }

    const [lastMatch] = await Promise.all([ListenerMatchHistory.findOne({ userId }).lean()]);

    const lastMatchedListenerId = lastMatch?.lastListenerId;

    const callTypeCapitalized = callType === "audio" ? "Audio" : "Video";
    const callModeCapitalized = callMode === "private" ? "Private" : "Random";
    const availabilityField = `isAvailableFor${callModeCapitalized}${callTypeCapitalized}Call`;

    const realListenerQuery = {
      status: 2,
      isFake: false,
      isBlock: false,
      isOnline: true,
      isBusy: false,
      callId: null,
      [availabilityField]: true,
    };

    let availableListeners = await Listener.find(realListenerQuery).lean();

    if (availableListeners.length === 0 && settingJSON?.isDemoContentEnabled === true) {
      const fakeListenerQuery = {
        isFake: true,
      };

      availableListeners = await Listener.find(fakeListenerQuery).lean();
    }

    if (availableListeners.length > 1 && lastMatchedListenerId) {
      availableListeners = availableListeners.filter((listener) => listener._id.toString() !== lastMatchedListenerId.toString());
    }

    if (availableListeners.length === 0) {
      return res.status(200).json({ status: false, message: "No available listeners found!" });
    }

    const matchedListener = availableListeners[Math.floor(Math.random() * availableListeners.length)];

    res.status(200).json({
      status: true,
      message: "Matched listener retrieved!",
      data: matchedListener,
    });

    await ListenerMatchHistory.findOneAndUpdate({ userId }, { lastListenerId: matchedListener._id }, { upsert: true, new: true });
  } catch (error) {
    console.error("Match Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

//get for you listener list
exports.fetchRecommendedListeners = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { start = 1, limit = 20, searchString = "", language, talkTopic, gender, ageFrom, ageTo, country, communicationType } = req.query;

    const parsedStart = parseInt(start);
    const parsedLimit = parseInt(limit);
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const languageArray = typeof language === "string" ? (language === "All" ? [] : language.split(",")) : Array.isArray(language) ? language : [];

    const topicArray = typeof talkTopic === "string" ? (talkTopic === "All" ? [] : talkTopic.split(",")) : Array.isArray(talkTopic) ? talkTopic : [];

    const baseConditions = [{ isBlock: false }, { status: 2 }, { userId: { $ne: userId } }, { isFake: false }];

    const orConditions = [];

    if (languageArray.length > 0) {
      orConditions.push({
        language: {
          $in: languageArray.map((lang) => new RegExp(`^${lang.trim()}$`, "i")),
        },
      });
    }

    if (topicArray.length > 0) {
      orConditions.push({
        talkTopics: {
          $in: topicArray.map((topic) => new RegExp(`^${topic.trim()}$`, "i")),
        },
      });
    }

    if (gender && gender !== "All") {
      orConditions.push({
        gender: new RegExp(`^${gender.trim()}$`, "i"),
      });
    }

    if (country && country !== "All") {
      orConditions.push({
        country: new RegExp(`^${country.trim()}$`, "i"),
      });
    }

    if (ageFrom || ageTo) {
      const ageFilter = {};
      if (ageFrom) ageFilter.$gte = parseInt(ageFrom);
      if (ageTo) ageFilter.$lte = parseInt(ageTo);
      orConditions.push({ age: ageFilter });
    }

    if (communicationType && communicationType !== "All") {
      const type = communicationType.toLowerCase();
      if (type === "chat") {
        orConditions.push({ isAvailableForChat: true });
      } else if (type === "audio") {
        orConditions.push({
          $or: [{ isAvailableForPrivateAudioCall: true }, { isAvailableForRandomAudioCall: true }],
        });
      } else if (type === "video") {
        orConditions.push({
          $or: [{ isAvailableForPrivateVideoCall: true }, { isAvailableForRandomVideoCall: true }],
        });
      }
    }

    const filterConditions = [...baseConditions];
    if (orConditions.length > 0) {
      filterConditions.push({ $or: orConditions });
    }

    const pipeline = [
      { $match: { $and: filterConditions } },
      ...(searchString && searchString !== "All"
        ? [
            {
              $match: {
                $or: [
                  { name: { $regex: searchString, $options: "i" } },
                  { language: { $regex: searchString, $options: "i" } },
                  { uniqueId: { $regex: searchString, $options: "i" } },
                  { talkTopics: { $regex: searchString, $options: "i" } },
                ],
              },
            },
          ]
        : []),

      {
        $addFields: {
          statusLabel: {
            $cond: [
              {
                $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", false] }, { $eq: ["$callId", null] }],
              },
              "Available",
              {
                $cond: [
                  {
                    $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }, { $ne: ["$callId", null] }],
                  },
                  "On Call",
                  "Offline",
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          name: 1,
          image: 1,
          talkTopics: 1,
          language: 1,
          age: 1,
          gender: 1,
          location: 1,
          ratePrivateVideoCall: 1,
          ratePrivateAudioCall: 1,
          rateRandomVideoCall: 1,
          rateRandomAudioCall: 1,
          rating: 1,
          experience: 1,
          statusLabel: 1,
          callCount: 1,
          video: 1,
          audio: 1,
          uniqueId: 1,
          isAvailableForPrivateAudioCall: 1,
          isAvailableForPrivateVideoCall: 1,
          isAvailableForRandomVideoCall: 1,
          isAvailableForRandomAudioCall: 1,
          isAvailableForChat: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (parsedStart - 1) * parsedLimit },
      { $limit: parsedLimit },
    ];

    const result = await Listener.aggregate(pipeline);

    return res.status(200).json({
      status: true,
      message: "Listeners fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("fetchRecommendedListeners error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
  }
};

//edit listener profile
