const Listener = require("../../models/listener.model");

//import model
const User = require("../../models/user.model");
const Notification = require("../../models/notification.model");

//mongoose
const mongoose = require("mongoose");

//private key
const admin = require("../../util/privateKey");

//fs
const fs = require("fs");

//deletefile
const { deleteFiles } = require("../../util/deletefile");

//unique Id
const generateUniqueId = require("../../util/generateUniqueId");

//retrive listener requests
exports.getListenerRequests = async (req, res) => {
  try {
    const { status, gender = "All", start = 1, limit = 20, searchString = "All" } = req.query || {};

    if (!status) {
      return res.status(200).json({ status: false, message: "Invalid request parameters." });
    }

    const parsedStart = parseInt(start, 10);
    const parsedLimit = parseInt(limit, 10);

    const matchStage = {
      isFake: false,
    };

    if (status !== "All") {
      matchStage.status = parseInt(status, 10);
    }

    if (gender !== "All") {
      matchStage.gender = gender.trim().toLowerCase();
    }

    const searchFilter =
      searchString !== "All"
        ? {
            $or: [
              { name: { $regex: searchString, $options: "i" } },
              { uniqueId: { $regex: searchString, $options: "i" } },
              { language: { $regex: searchString, $options: "i" } },
              { talkTopics: { $regex: searchString, $options: "i" } },
              { "userId.nickName": { $regex: searchString, $options: "i" } },
              { "userId.fullName": { $regex: searchString, $options: "i" } },
              { "userId.email": { $regex: searchString, $options: "i" } },
              { "userId.uniqueId": { $regex: searchString, $options: "i" } },
              { "userId.gender": { $regex: searchString, $options: "i" } },
            ],
          }
        : {};

    const [result] = await Promise.all([
      Listener.aggregate([
        { $match: matchStage },

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
                  email: 1,
                  uniqueId: 1,
                  gender: 1,
                  profilePic: 1,
                },
              },
            ],
            as: "userId",
          },
        },
        { $unwind: { path: "$userId", preserveNullAndEmptyArrays: false } },

        ...(searchString !== "All" ? [{ $match: searchFilter }] : []),

        {
          $facet: {
            data: [{ $sort: { createdAt: -1 } }, { $skip: (parsedStart - 1) * parsedLimit }, { $limit: parsedLimit }],
            stats: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                },
              },
            ],
          },
        },

        {
          $project: {
            data: 1,
            total: { $ifNull: [{ $arrayElemAt: ["$stats.total", 0] }, 0] },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Retrieved listener requests for admin.",
      total: result[0].total || 0,
      data: result[0].data || [],
    });
  } catch (error) {
    console.error("Error fetching listener requests:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//accept Or decline listener request
exports.handleListenerRequest = async (req, res) => {
  try {
    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Settings not found." });
    }

    const { requestId, userId, status, reason } = req.query;

    if (!requestId || !userId || !status) {
      return res.status(200).json({ status: false, message: "Invalid details provided." });
    }

    const listenerId = new mongoose.Types.ObjectId(requestId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const statusNumber = Number(status);

    const listener = await Listener.findOne({ _id: listenerId }).lean();

    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener request not found." });
    }

    if (listener.status === 2) {
      return res.status(200).json({ status: false, message: "Listener request has already been accepted." });
    }

    if (listener.status === 3) {
      return res.status(200).json({ status: false, message: "Listener request has already been rejected." });
    }

    if (statusNumber === 2) {
      res.status(200).json({
        status: true,
        message: "Listener request accepted successfully.",
        data: {
          ...listener,
          status: 2,
          rateRandomVideoCall: settingJSON.videoCallRateRandom,
          rateRandomAudioCall: settingJSON.audioCallRateRandom,
          ratePrivateVideoCall: settingJSON.videoCallRatePrivate,
          ratePrivateAudioCall: settingJSON.audioCallRatePrivate,
        },
      });

      await Promise.all([
        Listener.updateOne(
          { _id: listenerId },
          {
            $set: {
              status: 2,
              rateRandomVideoCall: settingJSON.videoCallRateRandom,
              rateRandomAudioCall: settingJSON.audioCallRateRandom,
              ratePrivateVideoCall: settingJSON.videoCallRatePrivate,
              ratePrivateAudioCall: settingJSON.audioCallRatePrivate,
              reviewAt: new Date(),
            },
          },
        ),
        User.updateOne({ _id: userObjectId }, { $set: { isListener: true, listenerId: listenerId } }),
      ]);

      if (listener.isNotificationEnabled && !listener.isBlock && listener.fcmToken) {
        const payload = {
          token: listener.fcmToken,
          data: {
            title: "🎉 Listener Verification Successful!",
            body: "Congratulations! Your listener request has been approved. You’re now live!",
            type: "listener_verified",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);
          console.log("Notification sent successfully.");

          const notification = new Notification();
          notification.listenerId = listener._id;
          notification.title = `🎉 Listener Verification Successful!`;
          notification.message = `Congratulations! Your listener request has been approved. You’re now live!`;
          notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          await notification.save();
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    } else if (statusNumber === 3) {
      if (!reason || reason.trim() === "") {
        return res.status(200).json({ status: false, message: "Please provide a reason for rejection." });
      }

      res.status(200).json({
        status: true,
        message: "Listener request rejected successfully.",
        data: { ...listener, status: 3, reason: reason.trim() },
      });

      await Listener.updateOne(
        { _id: listenerId },
        {
          $set: {
            status: 3,
            reason: reason.trim(),
            reviewAt: new Date(),
          },
        },
      );

      if (listener.isNotificationEnabled && !listener.isBlock && listener.fcmToken) {
        const payload = {
          token: listener.fcmToken,
          data: {
            title: "❌ Listener Request Declined",
            body: "Your listener request was declined. Please review the feedback or contact support.",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);
          console.log("Notification sent successfully.");

          const notification = new Notification();
          notification.listenerId = listener._id;
          notification.title = `❌ Listener Request Declined`;
          notification.message = `Your listener request was declined. Please review the feedback or contact support.`;
          notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          await notification.save();
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    } else {
      return res.status(200).json({ status: false, message: "Invalid status value provided." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};

//add listener
exports.createListener = async (req, res) => {
  try {
    const {
      email,
      name,
      nickName,
      phoneNumber,
      selfIntro,
      talkTopics,
      language,
      location,
      experience,
      age,
      ratePrivateVideoCall,
      ratePrivateAudioCall,
      rateRandomVideoCall,
      rateRandomAudioCall,
      userId,
    } = req.body;

    if (
      !email ||
      !location ||
      !experience ||
      !age ||
      !name ||
      !nickName ||
      !phoneNumber ||
      !selfIntro ||
      !talkTopics ||
      !language ||
      !req.files ||
      !Array.isArray(req.files.image) ||
      req.files.image.length === 0
    ) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const isFakeListener = !userId;
    const missingFakeFiles = isFakeListener && (!Array.isArray(req.files.video) || req.files.video.length === 0 || !Array.isArray(req.files.audio) || req.files.audio.length === 0);

    if (missingFakeFiles) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "Oops! Invalid or missing required details.",
      });
    }

    const promiseArray = [generateUniqueId(), Listener.findOne({ email }).select("_id").lean()];

    if (userId) {
      promiseArray.push(User.findById(userId).select("_id isListener").lean());
    }

    const [uniqueId, existingListener, foundUser] = await Promise.all(promiseArray);

    if (existingListener) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! A listener already exists." });
    }

    if (userId) {
      if (!foundUser) {
        if (req.files) deleteFiles(req.files);
        return res.status(200).json({ status: false, message: "User not found with provided userId." });
      }

      if (foundUser.isListener) {
        if (req.files) deleteFiles(req.files);
        return res.status(200).json({ status: false, message: "User is already a listener." });
      }
    }

    const talkTopicArray = Array.isArray(talkTopics) ? talkTopics.flatMap((t) => t.split(",").map((s) => s.trim())) : talkTopics.split(",").map((s) => s.trim());

    const languages = Array.isArray(language) ? language.flatMap((l) => l.split(",").map((s) => s.trim())) : language.split(",").map((s) => s.trim());

    const getRandomIntInclusive = (min, max) => {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const callCount = getRandomIntInclusive(5, 50);
    const ratingCount = getRandomIntInclusive(1, 5);

    const newListener = new Listener({
      userId: userId || null,
      email,
      name,
      nickName,
      selfIntro,
      experience,
      age,
      talkTopics: talkTopicArray,
      language: languages,
      location,
      phoneNumber: phoneNumber || "",
      ratePrivateVideoCall: ratePrivateVideoCall || 0,
      ratePrivateAudioCall: ratePrivateAudioCall || 0,
      rateRandomVideoCall: rateRandomVideoCall || 0,
      rateRandomAudioCall: rateRandomAudioCall || 0,
      image: req.files.image ? req.files.image[0].path : "",
      audio: req.files.audio ? req.files.audio[0].path : "",
      video: req.files.video?.map((file) => file.path) || [],
      uniqueId,
      status: 2,
      callCount,
      rating: ratingCount,
      isFake: !userId, // false if userId exists
      reviewAt: new Date(),
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    res.status(200).json({
      status: true,
      message: "Listener created successfully.",
      newListener,
    });

    await newListener.save();

    if (userId) {
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            isListener: true,
            listenerId: newListener._id,
          },
        },
      );
    }
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update listener
exports.updateListenerProfile = async (req, res) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(req.query.listenerId);

    const listener = await Listener.findOne({ _id: listenerObjId });
    if (!listener) {
      if (req.files) deleteFiles(req.files);
      return res.status(404).json({ status: false, message: "Listener not found." });
    }

    const arrayFields = ["removeVideoIndexes"];
    for (const key of arrayFields) {
      if (req.body[key]) {
        if (typeof req.body[key] === "string") {
          try {
            req.body[key] = JSON.parse(req.body[key]);
          } catch (e) {
            if (req.files) deleteFiles(req.files);
            return res.status(200).json({ status: false, message: `Invalid format for '${key}'. It must be a valid JSON array.` });
          }
        }

        if (!Array.isArray(req.body[key])) {
          if (req.files) deleteFiles(req.files);
          return res.status(200).json({ status: false, message: `'${key}' must be an array.` });
        }
      }
    }

    res.status(200).json({ status: true, message: "Listener profile updated successfully." });

    if (req.files?.image?.[0]) {
      if (listener.image && fs.existsSync(listener.image)) {
        fs.unlinkSync(listener.image);
      }
      listener.image = req.files.image[0].path;
    }

    if (req.files?.audio?.[0]) {
      if (listener.audio && fs.existsSync(listener.audio)) {
        fs.unlinkSync(listener.audio);
      }
      listener.audio = req.files.audio[0].path;
    }

    if (Array.isArray(req.body.removeVideoIndexes)) {
      const validIndexes = req.body.removeVideoIndexes.map((i) => parseInt(i)).filter((i) => !isNaN(i) && i >= 0 && i < listener.video.length);
      validIndexes.sort((a, b) => b - a);

      for (const index of validIndexes) {
        const videoPath = listener.video[index];
        if (videoPath && fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
        listener.video.splice(index, 1);
      }
    }

    if (req.files?.video?.length) {
      const newVideos = req.files.video.map((file) => file.path);
      listener.video = listener.video.concat(newVideos);
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
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get listeners
exports.fetchListeners = async (req, res) => {
  try {
    const { start = 1, limit = 20, searchString = "", isFake, isBlock, isOnline, isBusy, gender = "All", startDate = "All", endDate = "All" } = req.query;

    const parsedStart = Number(start);
    const parsedLimit = Number(limit);

    if (isFake !== "true" && isFake !== "false") {
      return res.status(200).json({
        status: false,
        message: "Invalid 'isFake' query parameter. Allowed values: 'true' or 'false'.",
      });
    }

    const matchConditions = [];

    if (isBlock === "true" || isBlock === "false") {
      matchConditions.push({ isBlock: isBlock === "true" });
    }
    if (isOnline === "true" || isOnline === "false") {
      matchConditions.push({ isOnline: isOnline === "true" });
    }
    if (isBusy === "true" || isBusy === "false") {
      matchConditions.push({ isBusy: isBusy === "true" });
    }

    if (isFake === "true") {
      matchConditions.push({ isFake: true });
    } else {
      matchConditions.push({ status: 2, isFake: false });
    }

    if (gender && gender !== "All") {
      matchConditions.push({
        gender: gender.toLowerCase(),
      });
    }

    if (searchString && searchString !== "All") {
      const regex = new RegExp(searchString, "i");
      matchConditions.push({
        $or: [{ name: regex }, { uniqueId: regex }, { language: regex }, { talkTopics: regex }],
      });
    }

    if (startDate !== "All" && endDate !== "All") {
      const startObj = new Date(startDate);
      const endObj = new Date(endDate);
      endObj.setHours(23, 59, 59, 999);

      matchConditions.push({
        reviewAt: { $gte: startObj, $lte: endObj },
      });
    }

    const filter = matchConditions.length ? { $and: matchConditions } : {};

    const aggResult = await Listener.aggregate([
      { $match: filter },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: (parsedStart - 1) * parsedLimit },
            { $limit: parsedLimit },
            {
              $project: {
                name: 1,
                nickName: 1,
                email: 1,
                selfIntro: 1,
                age: 1,
                gender: 1,
                image: 1,
                talkTopics: 1,
                language: 1,
                uniqueId: 1,
                phoneNumber: 1,
                ratePrivateVideoCall: 1,
                ratePrivateAudioCall: 1,
                rateRandomVideoCall: 1,
                rateRandomAudioCall: 1,
                rating: 1,
                reviewCount: 1,
                experience: 1,
                callCount: 1,
                totalCoins: 1,
                currentCoinBalance: 1,
                isBlock: 1,
                isOnline: 1,
                isBusy: 1,
                video: 1,
                audio: 1,
                date: 1,
                reviewAt: 1,
                createdAt: 1,
                isAvailableForPrivateAudioCall: 1,
                isAvailableForPrivateVideoCall: 1,
                isAvailableForRandomAudioCall: 1,
                isAvailableForRandomVideoCall: 1,
                "userDetails.nickName": 1,
                "userDetails.fullName": 1,
                "userDetails.profilePic": 1,
                "userDetails.uniqueId": 1,
                "userDetails.gender": 1,
              },
            },
          ],

          totalCount: [{ $count: "count" }],

          genderStats: [
            {
              $group: {
                _id: null,
                male: {
                  $sum: {
                    $cond: [{ $eq: ["$gender", "male"] }, 1, 0],
                  },
                },
                female: {
                  $sum: {
                    $cond: [{ $eq: ["$gender", "female"] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    const response = aggResult[0] || {};

    const total = response.totalCount?.[0]?.count || 0;
    const totalMaleListeners = response.genderStats?.[0]?.male || 0;
    const totalFemaleListeners = response.genderStats?.[0]?.female || 0;

    return res.status(200).json({
      status: true,
      message: "Listeners fetched successfully",
      total,
      totalMaleListeners,
      totalFemaleListeners,
      data: response.data || [],
    });
  } catch (error) {
    console.error("fetchListeners error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//delete listener
exports.deleteListenerProfile = async (req, res) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. It must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(listenerId);

    const listener = await Listener.findOne({ _id: listenerObjId }).select("image audio identityProof video").lean();

    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener not found." });
    }

    res.status(200).json({ status: true, message: "Listener profile deleted successfully." });

    if (listener.image) {
      const imageParts = listener.image.split("storage");
      if (imageParts.length > 1) {
        const imagePath = "storage" + imageParts[1];
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }

    if (listener.audio) {
      const audioParts = listener.audio.split("storage");
      if (audioParts.length > 1) {
        const audioPath = "storage" + audioParts[1];
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      }
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

    if (Array.isArray(listener.video) && listener.video.length > 0) {
      for (const videoUrl of listener.video) {
        const videoPath = videoUrl?.split("storage");
        if (videoPath?.[1]) {
          const filePath = "storage" + videoPath[1];
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (error) {
              console.error(`Error deleting gallery video: ${filePath}`, error);
            }
          }
        }
      }
    }

    const updatedUser = await User.updateOne({ listenerId: listenerObjId }, { $set: { listenerId: null, isListener: false } });
    if (updatedUser.nModified > 0) {
      console.log(`Updated 1 user to remove listener reference.`);
    }

    await Listener.deleteOne({ _id: listenerObjId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//toggle block status
exports.updateBlockStatus = async (req, res, next) => {
  try {
    const { listenerId } = req.query;

    if (!listenerId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: listenerId." });
    }

    if (!mongoose.Types.ObjectId.isValid(listenerId)) {
      return res.status(200).json({ status: false, message: "Invalid listenerId. Must be a valid MongoDB ObjectId." });
    }

    const listenerObjId = new mongoose.Types.ObjectId(listenerId);

    const listener = await Listener.findById(listenerObjId).select("_id isBlock").lean();
    if (!listener) {
      return res.status(200).json({ status: false, message: "Listener not found." });
    }

    const newStatus = !listener.isBlock;

    const updatedListener = await Listener.findByIdAndUpdate(listenerObjId, { isBlock: newStatus }, { new: true, select: "isBlock" });

    if (!updatedListener) {
      return res.status(200).json({ status: false, message: "Failed to update block status." });
    }

    return res.status(200).json({
      status: true,
      message: `Listener has been ${newStatus ? "blocked" : "unblocked"} successfully.`,
      data: updatedListener,
    });
  } catch (error) {
    console.error("❌ Error toggling block status:", error);
    return res.status(500).json({ status: false, message: "An error occurred while updating block status." });
  }
};
