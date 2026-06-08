const User = require("./models/user.model");
const Listener = require("./models/listener.model");
const ChatTopic = require("./models/chatTopic.model");
const Chat = require("./models/chat.model");
const History = require("./models/history.model");
const Privatecall = require("./models/privatecall.model");
const Randomcall = require("./models/randomcall.model");
const Notification = require("./models/notification.model");

//private key
const admin = require("./util/privateKey");

//mongoose
const mongoose = require("mongoose");

//moment
const moment = require("moment-timezone");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("./util/generateHistoryUniqueId");

io.on("connection", async (socket) => {
  console.log("Socket Connection done Client ID: ", socket.id);

  const { globalRoom } = socket.handshake.query;
  const id = globalRoom.split(":")[1];
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    console.warn("Invalid or missing ID from globalRoom:", globalRoom);
    return;
  }

  console.log("Socket connected with:", id);

  if (globalRoom) {
    const user = await User.findById(id).select("_id").lean();
    if (user) {
      if (!socket.rooms.has(globalRoom)) {
        socket.join(globalRoom);
        console.log(`Socket joined room: ${globalRoom}`);
      } else {
        console.log(`Socket is already in room: ${globalRoom}`);
      }

      await User.updateOne({ _id: id }, { isOnline: true });
    } else {
      const listener = await Listener.findOne({ _id: id, status: 2 }).select("_id").lean();
      if (listener) {
        if (!socket.rooms.has(globalRoom)) {
          socket.join(globalRoom);
          console.log(`Socket joined room: ${globalRoom}`);
        } else {
          console.log(`Socket is already in room: ${globalRoom}`);
        }

        await Listener.updateOne({ _id: id }, { isOnline: true });
      }
    }
  } else {
    console.warn("Invalid globalRoom format:", globalRoom);
  }

  //chat
  socket.on("messageDispatched", async (data) => {
    const parseData = data;
    console.log("🔹 Data in messageDispatched:", parseData);

    let senderPromise, receiverPromise;

    const senderRole = parseData?.senderRole?.trim()?.toLowerCase();
    const receiverRole = parseData?.receiverRole?.trim()?.toLowerCase();

    if (senderRole === "user") {
      senderPromise = User.findById(parseData?.senderId).lean().select("_id fullName isOnline");
    } else if (senderRole === "listener") {
      senderPromise = Listener.findById(parseData?.senderId).lean().select("_id name isOnline");
    }

    if (receiverRole === "listener") {
      receiverPromise = Listener.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock isNotificationEnabled");
    } else if (receiverRole === "user") {
      receiverPromise = User.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock isNotificationEnabled");
    }

    const chatTopicPromise = ChatTopic.findById(parseData?.chatTopicId).lean().select("_id senderId receiverId chatId");

    const [sender, receiver, chatTopic] = await Promise.all([senderPromise, receiverPromise, chatTopicPromise]);

    if (!chatTopic) {
      console.log("❌ Chat topic not found");
      return;
    }

    if (parseData?.messageType == 1) {
      const chat = new Chat({
        messageType: parseData?.messageType,
        senderId: parseData?.senderId,
        message: parseData?.message,
        image: parseData?.image || "",
        chatTopicId: chatTopic._id,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      });

      await Promise.all([chat.save(), ChatTopic.updateOne({ _id: chatTopic._id }, { $set: { chatId: chat._id } })]);

      const eventData = {
        data,
        messageId: chat._id.toString(),
      };

      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("messageDispatched", eventData);
      io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("messageDispatched", eventData);

      if (receiver && receiver.isNotificationEnabled && !receiver.isBlock && receiver.fcmToken) {
        const senderName = parseData?.name || "";
        const senderProfilePic = parseData?.profilePic || "";
        const video = parseData?.video || [];
        const audio = parseData?.audio || "";
        const isFake = parseData?.isFake || false;
        const isAvailableForPrivateAudioCall = parseData?.isAvailableForPrivateAudioCall || false;
        const isAvailableForPrivateVideoCall = parseData?.isAvailableForPrivateVideoCall || false;
        const isAvailableForRandomAudioCall = parseData?.isAvailableForRandomAudioCall || false;
        const isAvailableForRandomVideoCall = parseData?.isAvailableForRandomVideoCall || false;
        const ratePrivateAudioCall = String(parseData?.ratePrivateAudioCall || "");
        const ratePrivateVideoCall = String(parseData?.ratePrivateVideoCall || "");

        const payload = {
          token: receiver.fcmToken,
          data: {
            title: `${senderName} sent you a message 💌`,
            body: `🗨️ ${chat?.message}`,
            type: "CHAT",
            senderId: String(sender?._id || ""),
            senderName: String(senderName || ""),
            senderProfilePic: senderProfilePic,
            isOnline: String(sender?.isOnline || false),
            ratePrivateAudioCall: ratePrivateAudioCall,
            ratePrivateVideoCall: ratePrivateVideoCall,
            video: JSON.stringify(video || []),
            isFake: String(isFake || false),
            isAvailableForPrivateAudioCall: String(isAvailableForPrivateAudioCall || false),
            isAvailableForPrivateVideoCall: String(isAvailableForPrivateVideoCall || false),
            isAvailableForRandomAudioCall: String(isAvailableForRandomAudioCall || false),
            isAvailableForRandomVideoCall: String(isAvailableForRandomVideoCall || false),
            audio: String(audio || ""),
          },
        };

        try {
          const adminInstance = await admin;
          const response = await adminInstance.messaging().send(payload);
          console.log("✅ Successfully sent FCM notification: ", response);

          const notification = new Notification();
          if (receiverRole === "user") {
            notification.userId = receiver._id;
          } else if (receiverRole === "listener") {
            notification.listenerId = receiver._id;
          }

          notification.title = `${senderName} sent you a message 💌`;
          notification.message = `🗨️ ${chat?.message}`;
          notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          await notification.save();
        } catch (error) {
          console.log("❌ Error sending FCM message:", error);
        }
      }
    } else {
      console.log("ℹ️ Other message type received");

      const eventData = {
        data,
        messageId: parseData?.messageId?.toString() || "",
      };

      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("messageDispatched", eventData);
      io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("messageDispatched", eventData);
    }
  });

  socket.on("markMessageSeen", async (data) => {
    try {
      const parsedData = data;
      console.log("🔹 Data in markMessageSeen event:", parsedData);

      const updated = await Chat.findByIdAndUpdate(parsedData.messageId, { $set: { isRead: true } }, { new: true, lean: true, select: "_id isRead" });

      if (!updated) {
        console.log(`No message found with ID ${parsedData.messageId}`);
      } else {
        console.log(`Updated isRead to true for message with ID: ${updated._id}`);
      }

      io.in("globalRoom:" + parsedData?.senderId?.toString()).emit("markMessageSeen", parsedData);
    } catch (error) {
      console.error("Error updating markMessageSeen:", error);
    }
  });

  //private video call
  socket.on("callOutgoingRinging", async (data) => {
  try {
    const parsedData = data;
    console.log("callOutgoingRinging request received:", parsedData);

    const { callerId, receiverId, channel, callType, callerRole, receiverRole } = parsedData;

    const validRoles = ["user", "listener"];
    if (!validRoles.includes(callerRole?.toLowerCase()) || !validRoles.includes(receiverRole?.toLowerCase())) {
      io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Invalid roles provided." });
      return;
    }

    const callerModel = callerRole.trim().toLowerCase() === "user" ? User : Listener;
    const receiverModel = receiverRole.trim().toLowerCase() === "listener" ? Listener : User;

    const [callUniqueId, caller, receiver] = await Promise.all([
      generateHistoryUniqueId(),
      callerModel.findOne({
        _id: callerId,
        ...(callerRole.trim().toLowerCase() === "listener" ? { isFake: false } : {}),
      }).select("_id nickName fullName profilePic name image isBlock isOnline isBusy callId").lean(),
      receiverModel.findOne({
        _id: receiverId,
        ...(receiverRole.trim().toLowerCase() === "listener" ? { isFake: false } : {}),
      }).select("_id nickName fullName profilePic name image isBlock isOnline isBusy callId fcmToken isNotificationEnabled isAvailableForPrivateVideoCall isAvailableForPrivateAudioCall").lean(),
    ]);

    const normalizeData = (userObj, role) => ({
      _id: userObj._id,
      nickName: userObj.nickName || "",
      fullName: role === "user" ? userObj.fullName || "" : userObj.name || "",
      profilePic: role === "user" ? userObj.profilePic || "" : userObj.image || "",
      isBlock: userObj.isBlock,
      isOnline: userObj.isOnline,
      isBusy: userObj.isBusy,
      callId: userObj.callId,
    });

    if (!caller) {
      io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Caller not found." });
      return;
    }
    if (caller.isBlock) {
      io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Caller is blocked.", isBlock: true });
      return;
    }
    if (caller.isBusy && caller.callId) {
      io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Caller is busy.", isBusy: true });
      return;
    }
    if (!receiver) {
      io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver not found." });
      return;
    }
    if (receiver.isBlock) {
      io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver is blocked.", isBlock: true });
      return;
    }
    if (receiver.isBusy && receiver.callId) {
      io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver is busy.", isBusy: true });
      return;
    }

    if (receiverRole.trim().toLowerCase() === "listener") {
      const requestedCallType = callType.trim().toLowerCase();
      if (requestedCallType === "audio" && !receiver.isAvailableForPrivateAudioCall) {
        io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver not available for audio calls.", isAvailable: false });
        return;
      }
      if (requestedCallType === "video" && !receiver.isAvailableForPrivateVideoCall) {
        io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver not available for video calls.", isAvailable: false });
        return;
      }
    }

    // ✅ REMOVED isOnline check blocking call setup
    if (!receiver.isBusy && receiver.callId === null) {
      console.log("Receiver is free. Proceeding with call setup.");

      const callHistory = new History();
      callHistory.uniqueId = callUniqueId;

      const [callerVerify, receiverVerify] = await Promise.all([
        callerModel.updateOne(
          { _id: caller._id, isBlock: false, isBusy: false, callId: null,
            ...(callerRole.trim().toLowerCase() === "listener" ? { isFake: false } : {}) },
          { $set: { isBusy: true, callId: callHistory._id.toString() } }
        ),
        receiverModel.updateOne(
          { _id: receiver._id, isBlock: false, isBusy: false, callId: null,
            ...(receiverRole.trim().toLowerCase() === "listener" ? { isFake: false } : {}) },
          { $set: { isBusy: true, callId: callHistory._id.toString() } }
        ),
      ]);

      if (callerVerify.modifiedCount > 0 && receiverVerify.modifiedCount > 0) {
        const normCaller = normalizeData(caller, callerRole.trim().toLowerCase());
        const normReceiver = normalizeData(receiver, receiverRole.trim().toLowerCase());

        const dataOfVideoCall = {
          callType: callType.trim().toLowerCase(),
          callerId: normCaller._id,
          receiverId: normReceiver._id,
          callerImage: normCaller.profilePic,
          callernickName: normCaller.nickName,
          callerfullName: normCaller.fullName,
          receiverName: normReceiver.fullName,
          receiverImage: normReceiver.profilePic,
          callId: callHistory._id,
          callMode: "private",
          channel: channel || "",
          callerRole: callerRole || "",
          receiverRole: receiverRole || "",
        };

        // ✅ Always emit to socket room (works if receiver is online)
        io.in("globalRoom:" + receiver._id.toString()).emit("incomingCall", dataOfVideoCall);
        io.in("globalRoom:" + caller._id.toString()).emit("callEstablished", dataOfVideoCall);

        // ✅ Always send FCM regardless of isOnline status
        // This is the KEY fix — host gets the call even when outside the app
        if (receiver.fcmToken && !receiver.isBlock) {
          const callerName = dataOfVideoCall.callerfullName?.trim() || dataOfVideoCall.callernickName?.trim() || "Someone";
          const isVideo = callType?.trim().toLowerCase() === "video";

          const payload = {
            token: receiver.fcmToken,
            android: {
              priority: "high", // ✅ Required for background delivery on Android
            },
            apns: {
              headers: {
                "apns-priority": "10", // ✅ Required for background delivery on iOS
              },
            },
            data: {
              title: isVideo ? `🎥 Video Call from ${callerName}!` : `📞 Audio Call from ${callerName}!`,
              body: isVideo
                ? `${callerName} is calling you. Tap to join!`
                : `${callerName} wants to chat. Tap to connect!`,
              type: "callIncoming",
              callType: dataOfVideoCall.callType,
              callId: dataOfVideoCall.callId.toString(),
              callerId: dataOfVideoCall.callerId.toString(),
              receiverId: dataOfVideoCall.receiverId.toString(),
              callerImage: dataOfVideoCall.callerImage || "",
              callernickName: dataOfVideoCall.callernickName || "",
              callerfullName: dataOfVideoCall.callerfullName || "",
              receiverName: dataOfVideoCall.receiverName || "",
              receiverImage: dataOfVideoCall.receiverImage || "",
              channel: dataOfVideoCall.channel || "",
              callMode: dataOfVideoCall.callMode || "private",
              callerRole: dataOfVideoCall.callerRole || "",
              receiverRole: dataOfVideoCall.receiverRole || "",
            },
          };

          const adminInstance = await admin;
          adminInstance.messaging().send(payload)
            .then(response => console.log("📨 FCM sent:", response))
            .catch(error => console.error("⚠️ FCM failed:", error));
        }

        // Save history
        if (callerRole.trim().toLowerCase() === "user") {
          callHistory.userId = normCaller._id;
          callHistory.listenerId = normReceiver._id;
        } else {
          callHistory.userId = normReceiver._id;
          callHistory.listenerId = normCaller._id;
        }
        callHistory.callerRole = callerRole.trim().toLowerCase();
        callHistory.type = callType?.trim()?.toLowerCase() === "audio" ? 3 : 4;
        callHistory.callType = callType.trim().toLowerCase();
        callHistory.isPrivate = true;
        callHistory.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        await Promise.all([
          callHistory.save(),
          Privatecall({ caller: normCaller._id, receiver: normReceiver._id }).save(),
        ]);

      } else {
        io.in("globalRoom:" + caller._id.toString()).emit("callOutgoingRinging", {
          message: "Call setup failed. One or both users became unavailable.",
          isBusy: true,
        });
        if (callerVerify.modifiedCount > 0) await callerModel.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } });
        if (receiverVerify.modifiedCount > 0) await receiverModel.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } });
      }

    } else {
      io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", {
        message: "Receiver is unavailable.",
        isBusy: true,
      });
    }

  } catch (error) {
    console.error("Error in callOutgoingRinging:", error);
  }
});
  socket.on("callResponseProcessed", async (data) => {
    try {
      const parsedData = data;

      const {
        callerId,
        receiverId,
        callId,
        isAccept,
        callType,
        callMode,
        callerRole, //"user" or "listener"
        receiverRole, //"user" or "listener"
      } = parsedData;

      console.log("🟢 [callResponseProcessed] Event received:", parsedData);

      const callerRoom = `globalRoom:${callerId}`;
      const receiverRoom = `globalRoom:${receiverId}`;

      console.log(`🔄 Fetching caller, receiver, and call history for callId: ${callId}`);

      const callerModel = callerRole.trim().toLowerCase() === "user" ? User : Listener;
      const receiverModel = receiverRole.trim().toLowerCase() === "listener" ? Listener : User;

      const [caller, receiver, callHistory] = await Promise.all([
        callerModel.findById(callerId).select("_id name isBusy callId fullName").lean(),
        receiverModel.findById(receiverId).select("_id name isBusy callId").lean(),
        History.findById(callId).select("_id callConnect callEndTime duration"),
      ]);

      if (!caller || !receiver || !callHistory) {
        console.error("❌ [callResponseProcessed] Invalid caller, receiver, or call history.");
        return io.to(callerRoom).emit("callResponseProcessed", { message: "Invalid call data." });
      }

      console.log(`✅ Caller: ${caller.fullName} | Receiver: ${receiver.name} | Call ID: ${callId}`);

      if (callMode.trim().toLowerCase() === "private") {
        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 [callResponseProcessed] Call rejected by receiver ${receiver.name}`);

          io.to(callerRoom).emit("callDeclined", data);
          io.to(receiverRoom).emit("callDeclined", data);

          const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
            callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
          ]);

          console.log(`🔹 Caller Status Updated:`, callerUpdate);
          console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
          console.log(`🔹 Private Call Deleted:`, privateCallDeleted);

          let chatTopic;
          chatTopic = await ChatTopic.findOne({
            $or: [
              {
                $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
              },
              {
                $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
              },
            ],
          });

          const chat = new Chat();

          if (!chatTopic) {
            chatTopic = new ChatTopic();
            chatTopic.senderId = caller._id;
            chatTopic.receiverId = receiver._id;
            chatTopic.chatId = chat._id;
          }

          chat.chatTopicId = chatTopic._id;
          chat.senderId = callerId;
          chat.messageType = callType.trim().toLowerCase() === "audio" ? 4 : 5;
          chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
          chat.callType = 2; // 2.declined
          chat.callId = callId;
          chat.isRead = true;
          chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

          chatTopic.chatId = chat._id;

          callHistory.callConnect = false;
          callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

          const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
          const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
          callHistory.duration = moment.utc(end.diff(start)).format("HH:mm:ss");

          await Promise.all([chat.save(), chatTopic.save(), callHistory?.save()]);
          console.log("✅ Call rejection chat & history saved.");
          return;
        }

        if (isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📞 [callResponseProcessed] Call accepted by receiver ${receiver.name}`);

          const privateCallDelete = await Privatecall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
            receiver: new mongoose.Types.ObjectId(receiver._id),
          });

          console.log("🗑 Private call entry deleted:", privateCallDelete);

          if (privateCallDelete?.deletedCount > 0) {
            console.log("🟢 Call accepted, emitting event...");

            const [callerSockets, receiverSockets] = await Promise.all([io.in(callerRoom).fetchSockets(), io.in(receiverRoom).fetchSockets()]);

            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];

            if (callerSocket && !callerSocket.rooms.has(callId)) {
              callerSocket.join(callId);
            }

            if (receiverSocket && !receiverSocket.rooms.has(callId)) {
              receiverSocket.join(callId);
            }

            io.in(callId.toString()).emit("callAnswered", data);

            console.log(`📡 [callAnswered] Event sent to both parties: Caller(${caller.fullName}) & Receiver(${receiver.name})`);

            let chatTopic;
            chatTopic = await ChatTopic.findOne({
              $or: [
                {
                  $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
                },
                {
                  $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
                },
              ],
            });

            const chat = new Chat();

            if (!chatTopic) {
              chatTopic = new ChatTopic();
              chatTopic.senderId = caller._id;
              chatTopic.receiverId = receiver._id;
              chatTopic.chatId = chat._id;
            }

            chat.chatTopicId = chatTopic._id;
            chat.senderId = callerId;
            chat.messageType = callType.trim().toLowerCase() === "audio" ? 4 : 5;
            chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
            chat.callType = 1; //1.received
            chat.callId = callId;
            chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

            chatTopic.chatId = chat._id;

            await Promise.all([
              chat?.save(),
              chatTopic?.save(),
              callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: true, callId: callId } }),
              receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: true, callId: callId } }),
              History.updateOne({ _id: callHistory._id }, { $set: { callConnect: true, callStartTime: moment().tz("Asia/Kolkata").format() } }),
            ]);

            // Increment callCount if receiver is a listener
            if (receiverRole.trim().toLowerCase() === "listener") {
              await Listener.findByIdAndUpdate(receiverId, { $inc: { callCount: 1 } });
              console.log(`🔢 Incremented callCount for listener ${receiver.name}`);
            }

            console.log("✅ Caller and Receiver status updated & call history saved.");
          } else {
            console.log(`🚨 Call disconnected`);

            io.to(receiverRoom).emit("callTimedOut", data);

            await Promise.all([
              callerModel.updateOne({ _id: caller._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
              receiverModel.updateOne({ _id: receiver._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
            ]);

            console.log("🔹 Caller & Receiver status reset.");
          }
        }
      }

      if (callMode.trim().toLowerCase() === "random") {
        // Only allow if caller is 'user' and receiver is 'listener'
        if (callerRole.trim().toLowerCase() !== "user" || receiverRole.trim().toLowerCase() !== "listener") {
          console.log("[callResponseProcessed] Invalid roles. callResponseProcessed is only allowed for user → listener calls.");
          io.in("globalRoom:" + callerId.toString()).emit("callResponseProcessed", "Only users can initiate calls with listeners.");
          return;
        }

        const callerModel = User;
        const receiverModel = Listener;

        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 [callResponseProcessed] Call rejected by receiver ${receiver.name}`);

          io.to(callerRoom).emit("callDeclined", data);
          io.to(receiverRoom).emit("callDeclined", data);

          const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
            callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Randomcall.deleteOne({ caller: caller._id }),
          ]);

          console.log(`🔹 Caller Status Updated:`, callerUpdate);
          console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
          console.log(`🔹 Random Call Deleted:`, randomCallDeleted);

          let chatTopic;
          chatTopic = await ChatTopic.findOne({
            $or: [
              {
                $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
              },
              {
                $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
              },
            ],
          });

          const chat = new Chat();

          if (!chatTopic) {
            chatTopic = new ChatTopic();
            chatTopic.senderId = caller._id;
            chatTopic.receiverId = receiver._id;
            chatTopic.chatId = chat._id;
          }

          chat.chatTopicId = chatTopic._id;
          chat.senderId = callerId;
          chat.messageType = callType.trim().toLowerCase() === "audio" ? 4 : 5;
          chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
          chat.callType = 2; // 2.declined
          chat.callId = callId;
          chat.isRead = true;
          chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

          chatTopic.chatId = chat._id;

          callHistory.callConnect = false;
          callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

          const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
          const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
          callHistory.duration = moment.utc(end.diff(start)).format("HH:mm:ss");

          await Promise.all([chat.save(), chatTopic.save(), callHistory?.save()]);
          console.log("✅ Call rejection chat & history saved.");
          return;
        }

        if (isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📞 [callResponseProcessed] Call accepted by receiver ${receiver.name}`);

          const randomCallDeleted = await Randomcall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
          });

          console.log("🗑 Private call entry deleted:", randomCallDeleted);

          if (randomCallDeleted?.deletedCount > 0) {
            console.log("🟢 Call accepted, emitting event...");

            const [callerSockets, receiverSockets] = await Promise.all([io.in(callerRoom).fetchSockets(), io.in(receiverRoom).fetchSockets()]);

            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];

            if (callerSocket && !callerSocket.rooms.has(callId)) {
              callerSocket.join(callId);
            }

            if (receiverSocket && !receiverSocket.rooms.has(callId)) {
              receiverSocket.join(callId);
            }

            io.to(callId.toString()).emit("callAnswered", data);

            console.log(`📡 [callAnswered] Event sent to both parties: Caller(${caller.fullName}) & Receiver(${receiver.name})`);

            let chatTopic;
            chatTopic = await ChatTopic.findOne({
              $or: [
                {
                  $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
                },
                {
                  $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
                },
              ],
            });

            const chat = new Chat();

            if (!chatTopic) {
              chatTopic = new ChatTopic();

              chatTopic.chatId = chat._id;
              chatTopic.senderId = caller._id;
              chatTopic.receiverId = receiver._id;
            }

            chat.chatTopicId = chatTopic._id;
            chat.senderId = callerId;
            chat.messageType = callType.trim().toLowerCase() === "audio" ? 4 : 5;
            chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
            chat.callType = 1; //1.received
            chat.callId = callId;
            chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

            chatTopic.chatId = chat._id;

            await Promise.all([
              chat?.save(),
              chatTopic?.save(),
              callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: true, callId: callId } }),
              receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: true, callId: callId } }, { $inc: { callCount: 1 } }),
              History.updateOne({ _id: callHistory._id }, { $set: { callConnect: true, callStartTime: moment().tz("Asia/Kolkata").format() } }),
            ]);

            console.log("✅ Caller and Receiver status updated & call history saved.");
          } else {
            console.log(`🚨 Call disconnected`);

            io.to(receiverRoom).emit("callTimedOut", data);

            await Promise.all([
              callerModel.updateOne({ _id: caller._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
              receiverModel.updateOne({ _id: receiver._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
            ]);

            console.log("🔹 Caller & Receiver status reset.");
          }
        }
      }
    } catch (error) {
      console.error("❌ [callResponseProcessed] Error:", error);
      io.to(`globalRoom:${socket.id}`).emit("callResponseProcessed", { message: "Server error. Please try again." });
    }
  });

  socket.on("callRejected", async (data) => {
    const parseData = data;
    const { callerId, receiverId, callId, callType, callMode, callerRole, receiverRole } = parseData;
    console.log("🟢 [callRejected] Event received:", parseData);

    console.log(`🔄 Fetching call details for callId: ${callId}`);

    const callerModel = callerRole.trim().toLowerCase() === "user" ? User : Listener;
    const receiverModel = receiverRole.trim().toLowerCase() === "listener" ? Listener : User;

    const [caller, receiver, callHistory] = await Promise.all([
      callerModel.findById(callerId).select("_id fullName nickName fcmToken isBlock").lean(),
      receiverModel.findById(receiverId).select("_id name nickName fcmToken isBlock isNotificationEnabled").lean(),
      History.findById(callId).select("_id userId callConnect"),
    ]);

    if (!caller || !receiver || !callHistory) {
      console.error("❌ [callRejected] Invalid caller, receiver, or call history.");
      return io.to(`globalRoom:${callerId}`).emit("callRejected", { message: "Invalid call data." });
    }

    io.to("globalRoom:" + callerId.toString()).emit("callEnded", data);
    io.to("globalRoom:" + receiverId.toString()).emit("callEnded", data);

    console.log(`✅ Caller: ${caller.fullName} | Receiver: ${receiver.name} | Call ID: ${callId}`);

    if (callMode.trim().toLowerCase() === "private") {
      const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
        callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
        receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
        Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, privateCallDeleted);
    }

    if (callMode.trim().toLowerCase() === "random") {
      // Only allow if caller is 'user' and receiver is 'listener'
      if (callerRole.trim().toLowerCase() !== "user" || receiverRole.trim().toLowerCase() !== "listener") {
        console.log("[callRejected] Invalid roles. callRejected is only allowed for user → listener calls.");
        io.in("globalRoom:" + callerId.toString()).emit("callRejected", "Only users can initiate calls with listeners.");
        return;
      }

      const callerModel = User;
      const receiverModel = Listener;

      const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
        callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
        receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
        Randomcall.deleteOne({ caller: caller._id }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, randomCallDeleted);
    }

    callHistory.callConnect = false;

    let chatTopic;
    chatTopic = await ChatTopic.findOne({
      $or: [
        {
          $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
        },
        {
          $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
        },
      ],
    });

    const chat = new Chat();

    if (!chatTopic) {
      chatTopic = new ChatTopic();
      chatTopic.senderId = caller._id;
      chatTopic.receiverId = receiver._id;
      chatTopic.chatId = chat._id;
      await chatTopic.save();
    }

    chat.chatTopicId = chatTopic._id;
    chat.callId = callHistory?._id;
    chat.senderId = callHistory?.userId;
    chat.messageType = callType.trim().toLowerCase() === "audio" ? 4 : 5;
    chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
    chat.callType = 3; //3.missedCall
    chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    chat.isRead = true;

    chatTopic.chatId = chat._id;

    await Promise.all([chat?.save(), chatTopic?.save(), callHistory?.save()]);

    if (receiver.isNotificationEnabled && !receiver.isBlock && receiver.fcmToken !== null) {
      const payload = {
        token: receiver.fcmToken,
        data: {
          title: "📞 Missed Call Alert! ⏳",
          body: `You just missed a call from ${caller.fullName || caller.nickName || "someone"}! Tap to reconnect now. 🔄✨`,
          type: "MISSED_CALL",
          callerId: callerId.toString(),
        },
      };

      const adminPromise = await admin;
      adminPromise
        .messaging()
        .send(payload)
        .then(async (response) => {
          console.log("Successfully sent with response: ", response);

          const notification = new Notification();
          if (receiverRole === "user") {
            notification.userId = receiver._id;
          } else if (receiverRole === "listener") {
            notification.listenerId = receiver._id;
          }

          notification.title = `📞 Missed Call Alert! ⏳`;
          notification.message = `You just missed a call from ${caller.fullName || caller.nickName || "someone"}! Tap to reconnect now. 🔄✨`;
          notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          await notification.save();
        })
        .catch((error) => {
          console.log("Error sending message:      ", error);
        });
    }
  });

  socket.on("callTerminated", async (data) => {
    const parseData = data;
    const { callerId, receiverId, callId, callType, callMode, callerRole, receiverRole } = parseData;
    console.log("[callTerminated]", "data in callTerminated:", parseData);

    const callerModel = callerRole.trim().toLowerCase() === "user" ? User : Listener;
    const receiverModel = receiverRole.trim().toLowerCase() === "listener" ? Listener : User;

    const [caller, receiver, callHistory] = await Promise.all([
      callerModel.findById(callerId).select("_id name").lean(),
      receiverModel.findById(receiverId).select("_id name").lean(),
      History.findById(callId).select("_id callConnect callStartTime callEndTime duration userId listenerId userCoin uniqueId"),
    ]);

    if (!caller || !receiver || !callHistory) {
      console.error("❌ [callTerminated] Invalid caller, receiver, or call history.");
      return io.to(`globalRoom:${callerId}`).emit("callTerminated", { message: "Invalid call data." });
    }

    io.to(callId.toString()).emit("callTerminated", data);
    io.socketsLeave(callId.toString());

    console.log(`✅ Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

    if (callMode.trim().toLowerCase() === "private") {
      const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
        callerModel.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
        receiverModel.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
        Privatecall.deleteOne({ caller: callerId, receiver: receiverId }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, privateCallDeleted);
    }

    if (callMode.trim().toLowerCase() === "random") {
      // Only allow if caller is 'user' and receiver is 'listener'
      if (callerRole.trim().toLowerCase() !== "user" || receiverRole.trim().toLowerCase() !== "listener") {
        console.log("[callTerminated] Invalid roles. callTerminated is only allowed for user → listener calls.");
        io.in("globalRoom:" + callerId.toString()).emit("callTerminated", "Only users can initiate calls with listeners.");
        return;
      }

      const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
        callerModel.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
        receiverModel.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
        Randomcall.deleteOne({ caller: callerId }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, randomCallDeleted);
    }

    //callHistory.callConnect = false;
    callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

    const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
    const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
    const duration = moment.utc(end.diff(start)).format("HH:mm:ss");
    callHistory.duration = duration;

    await Promise.all([
      Chat.findOneAndUpdate(
        { callId: callHistory._id },
        {
          $set: {
            callDuration: duration,
            messageType: callType.trim().toLowerCase() === "audio" ? 4 : 5,
            message: callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call",
            callType: 1, // 1 = Received Call
            isRead: true,
          },
        },
        { new: true },
      ),
      callHistory.save(),
    ]);

    const userId = callHistory.userId?.toString();
    if (callerRole.trim().toLowerCase() === "user" && userId) {
      const listenerData = await Listener.findById(callHistory.listenerId).select("uniqueId name nickName image");

      const summaryPayload = {
        listener: {
          uniqueId: listenerData?.uniqueId || "",
          name: listenerData?.name || "",
          nickName: listenerData?.nickName || "",
          image: listenerData?.image || "",
        },
        date: moment(callHistory.callStartTime).tz("Asia/Kolkata").format("D MMM, HH:mm"),
        duration: callHistory.duration,
        balanceUsed: callHistory.userCoin, // zero if free
        callId: callHistory.uniqueId,
      };

      io.to("globalRoom:" + userId.toString()).emit("callSummary", summaryPayload);

      console.log("[callSummary]", "summaryPayload in callSummary:", summaryPayload);
    }
  });

  socket.on("callCoinsDeducted", async (data) => {
    try {
      const parsedData = data;
      console.log("[callCoinsDeducted] Parsed Data:", parsedData);

      const { callerId, receiverId, callId, callMode, callerRole, receiverRole } = parsedData;

      const callerRoleLower = callerRole.trim().toLowerCase();
      const receiverRoleLower = receiverRole.trim().toLowerCase();

      let userId, listenerId, userModel, listenerModel;

      if (callerRoleLower === "user") {
        userId = callerId;
        listenerId = receiverId;
      } else if (receiverRoleLower === "user") {
        userId = receiverId;
        listenerId = callerId;
      } else {
        console.log("[callCoinsDeducted] Invalid roles. No user found.");
        io.in("globalRoom:" + callerId.toString()).emit("coinDeductionError", "One participant must be a user.");
        return;
      }

      userModel = User;
      listenerModel = Listener;

      const [user, listener, callHistory] = await Promise.all([
        userModel.findById(userId).select("_id coins").lean(),
        listenerModel.findById(listenerId).select("_id ratePrivateVideoCall ratePrivateAudioCall rateRandomVideoCall rateRandomAudioCall").lean(),
        History.findById(callId).select("_id callType isPrivate isRandom userId listenerId").lean(),
      ]);

      if (!user || !listener || !callHistory) {
        console.log("[callCoinsDeducted] User, Listener, or CallHistory not found!");
        io.in("globalRoom:" + userId.toString()).emit("coinDeductionError", "Participant not found.");
        return;
      }

      const adminCommissionRate = settingJSON?.adminCommissionPercent || 0;

      const callTypes = {
        private_audio: listener.ratePrivateAudioCall,
        private_video: listener.ratePrivateVideoCall,
        random_audio: listener.rateRandomAudioCall,
        random_video: listener.rateRandomVideoCall,
      };

      const callKey = `${callMode}_${callHistory.callType}`;
      const callRate = Math.abs(callTypes[callKey] || 0);
      const adminShare = Math.floor((callRate * adminCommissionRate) / 100);
      const listenerEarnings = callRate - adminShare;

      if (user.coins >= callRate) {
        console.log(`[callCoinsDeducted] Deducting ${callRate} coins from User: ${user._id}, Admin Share: ${adminShare}, Listener Earnings: ${listenerEarnings}`);

        await Promise.all([
          User.updateOne(
            { _id: user._id, coins: { $gte: callRate } },
            {
              $inc: {
                coins: -callRate,
                coinsSpent: callRate,
              },
            },
          ),
          Listener.updateOne(
            { _id: listener._id },
            {
              $inc: {
                totalCoins: listenerEarnings,
                currentCoinBalance: listenerEarnings,
              },
            },
          ),
          History.updateOne(
            { _id: callHistory._id },
            {
              $set: {
                date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
              },
              $inc: {
                userCoin: callRate,
                listenerCoin: listenerEarnings,
                adminCoin: adminShare,
              },
            },
          ),
        ]);

        console.log("[callCoinsDeducted] Coin deduction and history update successful.");
      } else {
        console.log(`[callCoinsDeducted] Insufficient Coins for User: ${user._id}`);
        io.in("globalRoom:" + user._id.toString()).emit("notEnoughCoins", "You don't have sufficient coins.");
      }
    } catch (error) {
      console.error("[callCoinsDeducted] Error:", error);
    }
  });

  //random video call
  socket.on("incomingRingingStarted", async (data) => {
    const parsedData = data;
    const { callType, callerId, receiverId, callerRole, receiverRole } = parsedData;
    console.log("incomingRingingStarted request received:", parsedData);

    if (!["user"].includes(callerRole) || !["listener"].includes(receiverRole)) {
      console.log("[incomingRingingStarted] Invalid roles. incomingRingingStarted is only allowed for user → listener calls.");
      io.in("globalRoom:" + callerId.toString()).emit("incomingRingingStarted", { message: "Invalid roles provided." });
      return;
    }

    const [callUniqueId, caller, receiver] = await Promise.all([
      generateHistoryUniqueId(),
      User.findById(callerId).select("_id nickName fullName profilePic isBlock isOnline isBusy callId").lean(),
      Listener.findById(receiverId).select("_id name image isBlock isOnline isBusy callId fcmToken isNotificationEnabled isAvailableForRandomAudioCall isAvailableForRandomVideoCall").lean(),
    ]);

    if (!caller) {
      io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", { message: "Caller does not found." });
      return;
    }

    if (caller.isBlock) {
      io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", {
        message: "Caller is blocked.",
        isBlock: true,
      });
      return;
    }

    if (caller.isBusy && caller.callId) {
      io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", {
        message: "Caller is busy with someone else.",
        isBusy: true,
      });
      return;
    }

    if (!receiver) {
      io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", { message: "Receiver does not found." });
      return;
    }

    if (receiver.isBlock) {
      io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", {
        message: "Receiver is blocked.",
        isBlock: true,
      });
      return;
    }

if (!receiver.isOnline) {
  if (receiver.fcmToken && receiver.isNotificationEnabled) {
    const callerName = caller?.fullName || caller?.nickName || "Someone";
    const isVideo = callType?.trim().toLowerCase() === "video";
    const adminInstance = await admin;
    adminInstance.messaging().send({
      token: receiver.fcmToken,
      android: { priority: "high" },
      apns: { headers: { "apns-priority": "10" } },
      data: {
        title: isVideo ? `🎥 Video Call from ${callerName}!` : `📞 Audio Call from ${callerName}!`,
        body: `${callerName} is calling you. Tap to answer!`,
        type: "callIncoming",
        callType: callType,
        callerId: callerId.toString(),
        receiverId: receiverId.toString(),
        callerImage: caller?.profilePic || "",
        callernickName: caller?.nickName || "",
        callerfullName: caller?.fullName || "",
        receiverName: receiver?.name || "",
        receiverImage: receiver?.image || "",
        callMode: "random",
        callerRole,
        receiverRole,
      },
    }).catch(e => console.error("⚠️ FCM failed:", e));

    io.in("globalRoom:" + callerId.toString()).emit("incomingRingingStarted", {
      message: "Receiver is offline, notifying via push...",
      isOnline: false,
      fcmSent: true,
    });
  } else {
    io.in("globalRoom:" + callerId.toString()).emit("incomingRingingStarted", {
      message: "Receiver is not online.",
      isOnline: false,
    });
  }
  return;
}

    if (receiver.isBusy && receiver.callId) {
      io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", {
        message: "Receiver is busy with another call.",
        isBusy: true,
      });
      return;
    }

    if (receiverRole.trim().toLowerCase() === "listener") {
      const requestedCallType = callType.trim().toLowerCase();

      if (requestedCallType === "audio" && !receiver.isAvailableForRandomAudioCall) {
        io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", {
          message: "Receiver is not available for random audio calls.",
          isAvailable: false,
        });
        return;
      }

      if (requestedCallType === "video" && !receiver.isAvailableForRandomVideoCall) {
        io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", {
          message: "Receiver is not available for random video calls.",
          isAvailable: false,
        });
        return;
      }
    }

    if (!receiver.isBusy && receiver.callId === null) {
      console.log("Receiver and Caller are free. Proceeding with call setup.");

      const callTypeCapitalized = callType.trim().toLowerCase() === "audio" ? "Audio" : "Video";
      const callModeCapitalized = "Random";
      const availabilityField = `isAvailableFor${callModeCapitalized}${callTypeCapitalized}Call`;

      const callHistory = new History();
      callHistory.uniqueId = callUniqueId;
      callHistory.callId = callUniqueId;

      const [callerVerify, receiverVerify] = await Promise.all([
        User.updateOne(
          {
            _id: caller._id,
            isOnline: true,
            isBusy: false,
            callId: null,
          },
          {
            $set: {
              isBusy: true,
              callId: callHistory._id.toString(),
            },
          },
        ),
        Listener.updateOne(
          {
            _id: receiver._id,
            isFake: false,
            isBlock: false,
            isOnline: true,
            isBusy: false,
            callId: null,
            [availabilityField]: true,
          },
          {
            $set: {
              isBusy: true,
              callId: callHistory._id.toString(),
            },
          },
        ),
      ]);

      if (callerVerify.modifiedCount > 0 && receiverVerify.modifiedCount > 0) {
        const dataOfVideoCall = {
          callType: callType,
          callerId: caller._id,
          receiverId: receiver._id,
          callerImage: caller.profilePic,
          callernickName: caller.nickName,
          callerfullName: caller.fullName,
          receiverName: receiver.name,
          receiverImage: receiver.image,
          callId: callHistory._id,
          callType: callType.trim().toLowerCase(),
          callMode: "random",
          callerRole,
          receiverRole,
        };

        io.in("globalRoom:" + receiver._id.toString()).emit("incomingCall", dataOfVideoCall); // Notify receiver
        io.in("globalRoom:" + caller._id.toString()).emit("callEstablished", dataOfVideoCall); // Notify caller

        console.log(`Call successfully initiated: ${caller.fullName} → ${receiver.name}`);

        if (receiver.isNotificationEnabled && !receiver.isBlock && receiver.fcmToken !== null) {
          const callerName = dataOfVideoCall.callerfullName?.trim() || dataOfVideoCall.callernickName?.trim() || "Someone";
          const isVideo = callType?.trim().toLowerCase() === "video";

          const notificationTitle = isVideo ? `🎥 Incoming Video Call Request` : `📞 Incoming Audio Call Request`;
          const notificationBody = isVideo
            ? `📲 You've got a random video call from ${callerName}. Join now for an exciting face-to-face chat! 💫`
            : `📞 ${callerName} is randomly calling you for a voice chat. Tap to start the conversation! 🔊💬`;
            
const payload = {
  token: receiver.fcmToken,
  android: { priority: "high" },                // ✅ ADD THIS
  apns: { headers: { "apns-priority": "10" } }, // ✅ ADD THIS
  data: {
    title: notificationTitle,
    body: notificationBody,
    type: "callIncoming",
    callType: dataOfVideoCall.callType,
    callId: dataOfVideoCall.callId.toString(),
    callerId: dataOfVideoCall.callerId.toString(),
    receiverId: dataOfVideoCall.receiverId.toString(),
    callerImage: dataOfVideoCall.callerImage || "",
    callernickName: dataOfVideoCall.callernickName || "",
    callerfullName: dataOfVideoCall.callerfullName || "",
    receiverName: dataOfVideoCall.receiverName || "",
    receiverImage: dataOfVideoCall.receiverImage || "",
    channel: dataOfVideoCall.channel || "",
    callMode: dataOfVideoCall.callMode || "private",
    callerRole: dataOfVideoCall.callerRole || "",
    receiverRole: dataOfVideoCall.receiverRole || "",
  },
};

          const adminInstance = await admin;
          adminInstance
            .messaging()
            .send(payload)
            .then(async (response) => {
              console.log("📨 Call notification sent successfully:", response);

              const notification = new Notification();
              if (receiverRole === "user") {
                notification.userId = receiver._id;
              } else if (receiverRole === "listener") {
                notification.listenerId = receiver._id;
              }

              notification.title = notificationTitle;
              notification.message = notificationBody;
              notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
              await notification.save();
            })
            .catch((error) => {
              console.error("⚠️ Failed to send call notification:", error);
            });
        }

        callHistory.callerRole = "user";
        callHistory.type = callType?.trim()?.toLowerCase() === "audio" ? 5 : callType?.trim()?.toLowerCase() === "video" ? 6 : null;
        callHistory.callType = callType?.trim()?.toLowerCase();
        callHistory.isRandom = true;
        callHistory.userId = caller._id;
        callHistory.listenerId = receiver._id;
        callHistory.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        await Promise.all([
          callHistory.save(),
          Randomcall({
            caller: caller._id,
          }).save(),
        ]);
      } else {
        console.log("Failed to verify caller or receiver availability");

        io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", {
          message: "Call setup failed. One or both users became unavailable.",
          isBusy: true,
        });

        // Update isBusy only for the user who failed verification
        if (callerVerify.modifiedCount > 0) {
          await User.updateOne({ _id: callerId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 Caller Status Updated: Caller verification failed, isBusy reset`);
        }

        if (receiverVerify.modifiedCount > 0) {
          await User.updateOne({ _id: receiverId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 Receiver Status Updated: Receiver verification failed, isBusy reset`);
        }
        return;
      }
    } else {
      console.log("Condition not met - receiver not available");

      io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", {
        message: "Receiver is unavailable for a call at this moment.",
        isBusy: true,
      });
      return;
    }
  });

  socket.on("disconnect", async (reason) => {
  console.log(`Socket disconnected: ${id} - Reason: ${reason}`);

  if (globalRoom) {
    // ✅ Wait 5 seconds before marking offline
    // This handles brief disconnects when host switches apps
    await new Promise(resolve => setTimeout(resolve, 5000));

    const sockets = await io.in(globalRoom).fetchSockets();
    console.log("Active sockets in room after delay:", sockets.length);

    if (sockets?.length == 0) {
      const personId = new mongoose.Types.ObjectId(id);
      const listener = await Listener.findById(personId).select("_id").lean();
      if (listener) {
        await Listener.updateOne({ _id: listener._id }, { $set: { isOnline: false, isBusy: false, callId: null } });
      } else {
        const user = await User.findById(personId).select("_id").lean();
        if (user) {
          await User.updateOne({ _id: user._id }, { $set: { isOnline: false, isBusy: false, callId: null } });
        }
      }
    }
  }
});
});
