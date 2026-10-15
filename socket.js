const User = require("./models/user.model");
const Listener = require("./models/listener.model");
const ChatTopic = require("./models/chatTopic.model");
const Chat = require("./models/chat.model");
const History = require("./models/history.model");
const Privatecall = require("./models/privatecall.model");
const Randomcall = require("./models/randomcall.model");
const Notification = require("./models/notification.model");

const admin = require("./util/privateKey");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const generateHistoryUniqueId = require("./util/generateHistoryUniqueId");

io.on("connection", async (socket) => {
  console.log("Socket Connection done Client ID: ", socket.id);

  const { globalRoom } = socket.handshake.query;
  const id = globalRoom?.split(":")[1];

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
      }
      await User.updateOne({ _id: id }, { isOnline: true });
    } else {
      const listener = await Listener.findOne({ _id: id, status: 2 }).select("_id").lean();
      if (listener) {
        if (!socket.rooms.has(globalRoom)) {
          socket.join(globalRoom);
          console.log(`Socket joined room: ${globalRoom}`);
        }
        await Listener.updateOne({ _id: id }, { isOnline: true });
      }
    }
  }

  // ─────────────────────────────────────────
  // CHAT
  // ─────────────────────────────────────────
  socket.on("messageDispatched", async (data) => {
    try {
      const parseData = data;
      console.log("🔹 Data in messageDispatched:", parseData);

      const senderRole = parseData?.senderRole?.trim()?.toLowerCase();
      const receiverRole = parseData?.receiverRole?.trim()?.toLowerCase();

      let senderPromise, receiverPromise;

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

        await Promise.all([
          chat.save(),
          ChatTopic.updateOne({ _id: chatTopic._id }, { $set: { chatId: chat._id } }),
        ]);

        const eventData = { data, messageId: chat._id.toString() };

        io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("messageDispatched", eventData);
        io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("messageDispatched", eventData);

        if (receiver && receiver.isNotificationEnabled && !receiver.isBlock && receiver.fcmToken) {
          const senderName = parseData?.name || "";
          const payload = {
            token: receiver.fcmToken,
            data: {
              title: `${senderName} sent you a message 💌`,
              body: `🗨️ ${chat?.message}`,
              type: "CHAT",
              senderId: String(sender?._id || ""),
              senderName: String(senderName || ""),
              senderProfilePic: parseData?.profilePic || "",
              isOnline: String(sender?.isOnline || false),
              ratePrivateAudioCall: String(parseData?.ratePrivateAudioCall || ""),
              ratePrivateVideoCall: String(parseData?.ratePrivateVideoCall || ""),
              video: JSON.stringify(parseData?.video || []),
              isFake: String(parseData?.isFake || false),
              isAvailableForPrivateAudioCall: String(parseData?.isAvailableForPrivateAudioCall || false),
              isAvailableForPrivateVideoCall: String(parseData?.isAvailableForPrivateVideoCall || false),
              isAvailableForRandomAudioCall: String(parseData?.isAvailableForRandomAudioCall || false),
              isAvailableForRandomVideoCall: String(parseData?.isAvailableForRandomVideoCall || false),
              audio: String(parseData?.audio || ""),
            },
          };

          try {
            const adminInstance = await admin;
            const response = await adminInstance.messaging().send(payload);
            console.log("✅ FCM sent:", response);

            const notification = new Notification();
            if (receiverRole === "user") notification.userId = receiver._id;
            else if (receiverRole === "listener") notification.listenerId = receiver._id;
            notification.title = `${senderName} sent you a message 💌`;
            notification.message = `🗨️ ${chat?.message}`;
            notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            await notification.save();
          } catch (error) {
            console.log("❌ FCM error:", error);
          }
        }
      } else {
        const eventData = { data, messageId: parseData?.messageId?.toString() || "" };
        io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("messageDispatched", eventData);
        io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("messageDispatched", eventData);
      }
    } catch (error) {
      console.error("❌ [messageDispatched] Error:", error);
    }
  });

  socket.on("markMessageSeen", async (data) => {
    try {
      const parsedData = data;
      const updated = await Chat.findByIdAndUpdate(
        parsedData.messageId,
        { $set: { isRead: true } },
        { new: true, lean: true, select: "_id isRead" }
      );
      if (!updated) {
        console.log(`No message found with ID ${parsedData.messageId}`);
      }
      io.in("globalRoom:" + parsedData?.senderId?.toString()).emit("markMessageSeen", parsedData);
    } catch (error) {
      console.error("❌ [markMessageSeen] Error:", error);
    }
  });

  // ─────────────────────────────────────────
  // PRIVATE CALL
  // ─────────────────────────────────────────
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

      if (!caller) { io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Caller not found." }); return; }
      if (caller.isBlock) { io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Caller is blocked.", isBlock: true }); return; }
      if (caller.isBusy && caller.callId) { io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Caller is busy.", isBusy: true }); return; }
      if (!receiver) { io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver not found." }); return; }
      if (receiver.isBlock) { io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver is blocked.", isBlock: true }); return; }
      if (receiver.isBusy && receiver.callId) { io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver is busy.", isBusy: true }); return; }

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

      if (!receiver.isBusy && receiver.callId === null) {
        const callHistory = new History();
        callHistory.uniqueId = callUniqueId;

        const [callerVerify, receiverVerify] = await Promise.all([
          callerModel.updateOne(
            { _id: caller._id, isBlock: false, isBusy: false, callId: null, ...(callerRole.trim().toLowerCase() === "listener" ? { isFake: false } : {}) },
            { $set: { isBusy: true, callId: callHistory._id.toString() } }
          ),
          receiverModel.updateOne(
            { _id: receiver._id, isBlock: false, isBusy: false, callId: null, ...(receiverRole.trim().toLowerCase() === "listener" ? { isFake: false } : {}) },
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

          io.in("globalRoom:" + receiver._id.toString()).emit("incomingCall", dataOfVideoCall);
          io.in("globalRoom:" + caller._id.toString()).emit("callEstablished", dataOfVideoCall);

          if (receiver.fcmToken && !receiver.isBlock) {
            const callerName = dataOfVideoCall.callerfullName?.trim() || dataOfVideoCall.callernickName?.trim() || "Someone";
            const isVideo = callType?.trim().toLowerCase() === "video";
            const payload = {
              token: receiver.fcmToken,
              android: { priority: "high" },
              apns: { headers: { "apns-priority": "10" } },
              data: {
                title: isVideo ? `🎥 Video Call from ${callerName}!` : `📞 Audio Call from ${callerName}!`,
                body: isVideo ? `${callerName} is calling you. Tap to join!` : `${callerName} wants to chat. Tap to connect!`,
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
              .then(r => console.log("📨 FCM sent:", r))
              .catch(e => console.error("⚠️ FCM failed:", e));
          }

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

          // FIX 1: Added `new` keyword to Privatecall constructor
          await Promise.all([
            callHistory.save(),
            new Privatecall({ caller: normCaller._id, receiver: normReceiver._id }).save(),
          ]);
        } else {
          io.in("globalRoom:" + caller._id.toString()).emit("callOutgoingRinging", { message: "Call setup failed.", isBusy: true });
          if (callerVerify.modifiedCount > 0) await callerModel.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } });
          if (receiverVerify.modifiedCount > 0) await receiverModel.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } });
        }
      } else {
        io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Receiver is unavailable.", isBusy: true });
      }
    } catch (error) {
      console.error("❌ [callOutgoingRinging] Error:", error);
    }
  });

  socket.on("callResponseProcessed", async (data) => {
    try {
      const parsedData = data;
      const { callerId, receiverId, callId, isAccept, callType, callMode, callerRole, receiverRole } = parsedData;

      console.log("🟢 [callResponseProcessed] Event received:", parsedData);

      const callerRoom = `globalRoom:${callerId}`;
      const receiverRoom = `globalRoom:${receiverId}`;

      const callerModel = callerRole.trim().toLowerCase() === "user" ? User : Listener;
      const receiverModel = receiverRole.trim().toLowerCase() === "listener" ? Listener : User;

      const [caller, receiver, callHistory] = await Promise.all([
        callerModel.findById(callerId).select("_id name fullName isBusy callId").lean(),
        receiverModel.findById(receiverId).select("_id name isBusy callId").lean(),
        History.findById(callId).select("_id callConnect callStartTime callEndTime duration"),
      ]);

      if (!caller || !receiver || !callHistory) {
        console.error("❌ [callResponseProcessed] Invalid data.");
        return io.to(callerRoom).emit("callResponseProcessed", { message: "Invalid call data." });
      }

      // ─── PRIVATE CALL ───
      if (callMode.trim().toLowerCase() === "private") {

        // REJECTED
        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 Call rejected by ${receiver.name}`);

          io.to(callerRoom).emit("callDeclined", data);
          io.to(receiverRoom).emit("callDeclined", data);

          callHistory.callConnect = false;
          callHistory.callEndTime = moment().tz("Asia/Kolkata").format();
          const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
          const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
          callHistory.duration = moment.utc(end.diff(start)).format("HH:mm:ss");

          let chatTopic = await ChatTopic.findOne({
            $or: [
              { $and: [{ senderId: caller._id }, { receiverId: receiver._id }] },
              { $and: [{ senderId: receiver._id }, { receiverId: caller._id }] },
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
          chat.callType = 2;
          chat.callId = callId;
          chat.isRead = true;
          chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          chatTopic.chatId = chat._id;

          await Promise.all([
            chat.save(),
            chatTopic.save(),
            callHistory.save(),
            callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
          ]);
          console.log("✅ Call rejection saved.");
          return;
        }

        // ACCEPTED
        // FIX 2: Added `&& !callHistory.callConnect` to prevent double-accept from resetting the call
        if (isAccept && caller.callId?.toString() === callId.toString() && !callHistory.callConnect) {
          console.log(`📞 Call accepted by ${receiver.name}`);

          const privateCallDelete = await Privatecall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
            receiver: new mongoose.Types.ObjectId(receiver._id),
          });

          if (privateCallDelete?.deletedCount > 0) {
            const [callerSockets, receiverSockets] = await Promise.all([
              io.in(callerRoom).fetchSockets(),
              io.in(receiverRoom).fetchSockets(),
            ]);
            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];
            if (callerSocket && !callerSocket.rooms.has(callId)) callerSocket.join(callId);
            if (receiverSocket && !receiverSocket.rooms.has(callId)) receiverSocket.join(callId);

            // Emit to call room AND individual rooms as fallback
            io.in(callId.toString()).emit("callAnswered", data);
            io.to(callerRoom).emit("callAnswered", data);
            io.to(receiverRoom).emit("callAnswered", data);
            console.log(`📡 [callAnswered] emitted to both parties`);

            let chatTopic = await ChatTopic.findOne({
              $or: [
                { $and: [{ senderId: caller._id }, { receiverId: receiver._id }] },
                { $and: [{ senderId: receiver._id }, { receiverId: caller._id }] },
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
            chat.callType = 1;
            chat.callId = callId;
            chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            chatTopic.chatId = chat._id;

            if (receiverRole.trim().toLowerCase() === "listener") {
              await Listener.findByIdAndUpdate(receiverId, { $inc: { callCount: 1 } });
            }

            await Promise.all([
              chat.save(),
              chatTopic.save(),
              callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: true, callId: callId } }),
              receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: true, callId: callId } }),
              History.updateOne(
                { _id: callHistory._id },
                { $set: { callConnect: true, callStartTime: moment().tz("Asia/Kolkata").format() } }
              ),
            ]);
            console.log("✅ Private call accepted — history updated.");

          } else {
            // Privatecall entry gone — timed out
            console.log("🚨 Call timed out");
            io.to(receiverRoom).emit("callTimedOut", data);
            await Promise.all([
              callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
              receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            ]);
          }

        } else if (isAccept && callHistory.callConnect) {
          // FIX 2 continued: Second callResponseProcessed fired — call already connected, just re-emit callAnswered
          console.log("⚠️ [callResponseProcessed] Call already connected, re-emitting callAnswered");
          io.to(callerRoom).emit("callAnswered", data);
          io.to(receiverRoom).emit("callAnswered", data);
        }
      }

      // ─── RANDOM CALL ───
      if (callMode.trim().toLowerCase() === "random") {
        if (callerRole.trim().toLowerCase() !== "user" || receiverRole.trim().toLowerCase() !== "listener") {
          console.log("[callResponseProcessed] Invalid roles for random call.");
          io.in("globalRoom:" + callerId.toString()).emit("callResponseProcessed", "Only users can initiate calls with listeners.");
          return;
        }

        // REJECTED
        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 Random call rejected by ${receiver.name}`);

          io.to(callerRoom).emit("callDeclined", data);
          io.to(receiverRoom).emit("callDeclined", data);

          callHistory.callConnect = false;
          callHistory.callEndTime = moment().tz("Asia/Kolkata").format();
          const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
          const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
          callHistory.duration = moment.utc(end.diff(start)).format("HH:mm:ss");

          let chatTopic = await ChatTopic.findOne({
            $or: [
              { $and: [{ senderId: caller._id }, { receiverId: receiver._id }] },
              { $and: [{ senderId: receiver._id }, { receiverId: caller._id }] },
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
          chat.callType = 2;
          chat.callId = callId;
          chat.isRead = true;
          chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          chatTopic.chatId = chat._id;

          await Promise.all([
            chat.save(),
            chatTopic.save(),
            callHistory.save(),
            User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            Listener.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Randomcall.deleteOne({ caller: caller._id }),
          ]);
          console.log("✅ Random call rejection saved.");
          return;
        }

        // ACCEPTED
        // FIX 2: Added `&& !callHistory.callConnect` to prevent double-accept
        if (isAccept && caller.callId?.toString() === callId.toString() && !callHistory.callConnect) {
          console.log(`📞 Random call accepted by ${receiver.name}`);

          const randomCallDeleted = await Randomcall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
          });

          if (randomCallDeleted?.deletedCount > 0) {
            const [callerSockets, receiverSockets] = await Promise.all([
              io.in(callerRoom).fetchSockets(),
              io.in(receiverRoom).fetchSockets(),
            ]);
            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];
            if (callerSocket && !callerSocket.rooms.has(callId)) callerSocket.join(callId);
            if (receiverSocket && !receiverSocket.rooms.has(callId)) receiverSocket.join(callId);

            // Emit to call room AND individual rooms as fallback
            io.to(callId.toString()).emit("callAnswered", data);
            io.to(callerRoom).emit("callAnswered", data);
            io.to(receiverRoom).emit("callAnswered", data);
            console.log(`📡 [callAnswered] emitted for random call`);

            let chatTopic = await ChatTopic.findOne({
              $or: [
                { $and: [{ senderId: caller._id }, { receiverId: receiver._id }] },
                { $and: [{ senderId: receiver._id }, { receiverId: caller._id }] },
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
            chat.callType = 1;
            chat.callId = callId;
            chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            chatTopic.chatId = chat._id;

            await Promise.all([
              chat.save(),
              chatTopic.save(),
              User.updateOne({ _id: caller._id }, { $set: { isBusy: true, callId: callId } }),
              Listener.updateOne({ _id: receiver._id }, { $set: { isBusy: true, callId: callId } }),
              Listener.updateOne({ _id: receiver._id }, { $inc: { callCount: 1 } }),
              History.updateOne(
                { _id: callHistory._id },
                { $set: { callConnect: true, callStartTime: moment().tz("Asia/Kolkata").format() } }
              ),
            ]);
            console.log("✅ Random call accepted — history updated.");

          } else {
            console.log("🚨 Random call timed out");
            io.to(receiverRoom).emit("callTimedOut", data);
            await Promise.all([
              User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
              Listener.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            ]);
          }

        } else if (isAccept && callHistory.callConnect) {
          // FIX 2 continued: Second callResponseProcessed fired — re-emit callAnswered
          console.log("⚠️ [callResponseProcessed] Random call already connected, re-emitting callAnswered");
          io.to(callerRoom).emit("callAnswered", data);
          io.to(receiverRoom).emit("callAnswered", data);
        }
      }
    } catch (error) {
      console.error("❌ [callResponseProcessed] Error:", error);
      io.to(`globalRoom:${data?.callerId}`).emit("callResponseProcessed", { message: "Server error." });
    }
  });

  // ─────────────────────────────────────────
  // CALL REJECTED (timeout / no answer)
  // ─────────────────────────────────────────
  socket.on("callRejected", async (data) => {
    try {
      const parseData = data;
      const { callerId, receiverId, callId, callType, callMode, callerRole, receiverRole } = parseData;
      console.log("🟢 [callRejected] Event received:", parseData);

      // FIX 3: Guard against empty/invalid callId (happens when client fires before callEstablished)
      if (!callId || !mongoose.Types.ObjectId.isValid(callId)) {
        console.warn("⚠️ [callRejected] Empty or invalid callId — resetting busy state only");
        const callerModel = callerRole?.trim().toLowerCase() === "user" ? User : Listener;
        const receiverModel = receiverRole?.trim().toLowerCase() === "listener" ? Listener : User;
        await Promise.all([
          callerModel.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
          receiverModel.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
        ]);
        io.to(`globalRoom:${callerId}`).emit("callEnded", data);
        io.to(`globalRoom:${receiverId}`).emit("callEnded", data);
        return;
      }

      const callerModel = callerRole.trim().toLowerCase() === "user" ? User : Listener;
      const receiverModel = receiverRole.trim().toLowerCase() === "listener" ? Listener : User;

      const [caller, receiver, callHistory] = await Promise.all([
        callerModel.findById(callerId).select("_id fullName nickName fcmToken isBlock").lean(),
        receiverModel.findById(receiverId).select("_id name nickName fcmToken isBlock isNotificationEnabled").lean(),
        History.findById(callId).select("_id userId callConnect"),
      ]);

      if (!caller || !receiver || !callHistory) {
        console.error("❌ [callRejected] Invalid data.");
        return io.to(`globalRoom:${callerId}`).emit("callRejected", { message: "Invalid call data." });
      }

      io.to("globalRoom:" + callerId.toString()).emit("callEnded", data);
      io.to("globalRoom:" + receiverId.toString()).emit("callEnded", data);

      if (callMode.trim().toLowerCase() === "private") {
        await Promise.all([
          callerModel.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
          receiverModel.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
          Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
        ]);
      }

      if (callMode.trim().toLowerCase() === "random") {
        if (callerRole.trim().toLowerCase() !== "user" || receiverRole.trim().toLowerCase() !== "listener") {
          io.in("globalRoom:" + callerId.toString()).emit("callRejected", "Invalid roles.");
          return;
        }
        await Promise.all([
          User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
          Listener.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
          Randomcall.deleteOne({ caller: caller._id }),
        ]);
      }

      callHistory.callConnect = false;

      let chatTopic = await ChatTopic.findOne({
        $or: [
          { $and: [{ senderId: caller._id }, { receiverId: receiver._id }] },
          { $and: [{ senderId: receiver._id }, { receiverId: caller._id }] },
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
      chat.callType = 3; // missed
      chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      chat.isRead = true;
      chatTopic.chatId = chat._id;

      await Promise.all([chat.save(), chatTopic.save(), callHistory.save()]);

      if (receiver.isNotificationEnabled && !receiver.isBlock && receiver.fcmToken) {
        const payload = {
          token: receiver.fcmToken,
          data: {
            title: "📞 Missed Call Alert! ⏳",
            body: `You just missed a call from ${caller.fullName || caller.nickName || "someone"}!`,
            type: "MISSED_CALL",
            callerId: callerId.toString(),
          },
        };
        const adminInstance = await admin;
        adminInstance.messaging().send(payload)
          .then(async (response) => {
            console.log("✅ Missed call notification sent:", response);
            const notification = new Notification();
            if (receiverRole === "user") notification.userId = receiver._id;
            else if (receiverRole === "listener") notification.listenerId = receiver._id;
            notification.title = "📞 Missed Call Alert! ⏳";
            notification.message = `You just missed a call from ${caller.fullName || caller.nickName || "someone"}!`;
            notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            await notification.save();
          })
          .catch(e => console.log("❌ Missed call FCM error:", e));
      }
    } catch (error) {
      console.error("❌ [callRejected] Error:", error);
    }
  });

  // ─────────────────────────────────────────
  // CALL TERMINATED (end call)
  // ─────────────────────────────────────────
  socket.on("callTerminated", async (data) => {
    try {
      const parseData = data;
      const { callerId, receiverId, callId, callType, callMode, callerRole, receiverRole } = parseData;
      console.log("[callTerminated] data:", parseData);

      const callerModel = callerRole.trim().toLowerCase() === "user" ? User : Listener;
      const receiverModel = receiverRole.trim().toLowerCase() === "listener" ? Listener : User;

      const [caller, receiver, callHistory] = await Promise.all([
        callerModel.findById(callerId).select("_id name").lean(),
        receiverModel.findById(receiverId).select("_id name").lean(),
        History.findById(callId).select("_id callConnect callStartTime callEndTime duration userId listenerId userCoin uniqueId"),
      ]);

      if (!caller || !receiver || !callHistory) {
        console.error("❌ [callTerminated] Invalid data.");
        return io.to(`globalRoom:${callerId}`).emit("callTerminated", { message: "Invalid call data." });
      }

      io.to(callId.toString()).emit("callTerminated", data);
      io.socketsLeave(callId.toString());

      if (callMode.trim().toLowerCase() === "private") {
        await Promise.all([
          callerModel.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
          receiverModel.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
          Privatecall.deleteOne({ caller: callerId, receiver: receiverId }),
        ]);
      }

      if (callMode.trim().toLowerCase() === "random") {
        if (callerRole.trim().toLowerCase() !== "user" || receiverRole.trim().toLowerCase() !== "listener") {
          io.in("globalRoom:" + callerId.toString()).emit("callTerminated", "Invalid roles.");
          return;
        }
        await Promise.all([
          User.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
          Listener.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
          Randomcall.deleteOne({ caller: callerId }),
        ]);
      }

      callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

      // Guard against null callStartTime
      const rawStart = callHistory.callStartTime;
      const start = rawStart ? moment.tz(rawStart, "Asia/Kolkata") : moment().tz("Asia/Kolkata");
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
              callType: 1,
              isRead: true,
            },
          },
          { new: true }
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
          balanceUsed: callHistory.userCoin,
          callId: callHistory.uniqueId,
        };
        io.to("globalRoom:" + userId).emit("callSummary", summaryPayload);
        console.log("[callSummary] sent:", summaryPayload);
      }
    } catch (error) {
      console.error("❌ [callTerminated] Error:", error);
    }
  });

  // ─────────────────────────────────────────
  // COIN DEDUCTION
  // ─────────────────────────────────────────
  socket.on("callCoinsDeducted", async (data) => {
    try {
      const parsedData = data;
      console.log("[callCoinsDeducted] Parsed Data:", parsedData);

      const { callerId, receiverId, callId, callMode, callerRole, receiverRole } = parsedData;
      const callerRoleLower = callerRole.trim().toLowerCase();
      const receiverRoleLower = receiverRole.trim().toLowerCase();

      let userId, listenerId;
      if (callerRoleLower === "user") { userId = callerId; listenerId = receiverId; }
      else if (receiverRoleLower === "user") { userId = receiverId; listenerId = callerId; }
      else {
        io.in("globalRoom:" + callerId.toString()).emit("coinDeductionError", "One participant must be a user.");
        return;
      }

      const [user, listener, callHistory] = await Promise.all([
        User.findById(userId).select("_id coins").lean(),
        Listener.findById(listenerId).select("_id ratePrivateVideoCall ratePrivateAudioCall rateRandomVideoCall rateRandomAudioCall").lean(),
        History.findById(callId).select("_id callType isPrivate isRandom userId listenerId").lean(),
      ]);

      if (!user || !listener || !callHistory) {
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
        await Promise.all([
          User.updateOne({ _id: user._id, coins: { $gte: callRate } }, { $inc: { coins: -callRate, coinsSpent: callRate } }),
          Listener.updateOne({ _id: listener._id }, { $inc: { totalCoins: listenerEarnings, currentCoinBalance: listenerEarnings } }),
          History.updateOne(
            { _id: callHistory._id },
            { $set: { date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }) }, $inc: { userCoin: callRate, listenerCoin: listenerEarnings, adminCoin: adminShare } }
          ),
        ]);
        console.log("[callCoinsDeducted] Success.");
      } else {
        io.in("globalRoom:" + user._id.toString()).emit("notEnoughCoins", "Insufficient coins.");
      }
    } catch (error) {
      console.error("❌ [callCoinsDeducted] Error:", error);
    }
  });

  // ─────────────────────────────────────────
  // RANDOM CALL
  // ─────────────────────────────────────────
  socket.on("incomingRingingStarted", async (data) => {
    try {
      const parsedData = data;
      const { callType, callerId, receiverId, callerRole, receiverRole } = parsedData;
      console.log("incomingRingingStarted request received:", parsedData);

      if (!["user"].includes(callerRole) || !["listener"].includes(receiverRole)) {
        io.in("globalRoom:" + callerId.toString()).emit("incomingRingingStarted", { message: "Invalid roles provided." });
        return;
      }

      const [callUniqueId, caller, receiver] = await Promise.all([
        generateHistoryUniqueId(),
        User.findById(callerId).select("_id nickName fullName profilePic isBlock isOnline isBusy callId").lean(),
        Listener.findById(receiverId).select("_id name image isBlock isOnline isBusy callId fcmToken isNotificationEnabled isAvailableForRandomAudioCall isAvailableForRandomVideoCall").lean(),
      ]);

      if (!caller) { io.in("globalRoom:" + callerId.toString()).emit("incomingRingingStarted", { message: "Caller not found." }); return; }
      if (caller.isBlock) { io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", { message: "Caller is blocked.", isBlock: true }); return; }
      if (caller.isBusy && caller.callId) { io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", { message: "Caller is busy.", isBusy: true }); return; }
      if (!receiver) { io.in("globalRoom:" + callerId.toString()).emit("incomingRingingStarted", { message: "Receiver not found." }); return; }
      if (receiver.isBlock) { io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", { message: "Receiver is blocked.", isBlock: true }); return; }

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
          io.in("globalRoom:" + callerId.toString()).emit("incomingRingingStarted", { message: "Receiver offline, FCM sent.", isOnline: false, fcmSent: true });
        } else {
          io.in("globalRoom:" + callerId.toString()).emit("incomingRingingStarted", { message: "Receiver not online.", isOnline: false });
        }
        return;
      }

      if (receiver.isBusy && receiver.callId) { io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", { message: "Receiver is busy.", isBusy: true }); return; }

      if (receiverRole.trim().toLowerCase() === "listener") {
        const requestedCallType = callType.trim().toLowerCase();
        if (requestedCallType === "audio" && !receiver.isAvailableForRandomAudioCall) {
          io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Not available for random audio.", isAvailable: false });
          return;
        }
        if (requestedCallType === "video" && !receiver.isAvailableForRandomVideoCall) {
          io.in("globalRoom:" + callerId.toString()).emit("callOutgoingRinging", { message: "Not available for random video.", isAvailable: false });
          return;
        }
      }

      if (!receiver.isBusy && receiver.callId === null) {
        const callTypeCapitalized = callType.trim().toLowerCase() === "audio" ? "Audio" : "Video";
        const availabilityField = `isAvailableForRandom${callTypeCapitalized}Call`;

        const callHistory = new History();
        callHistory.uniqueId = callUniqueId;
        callHistory.callId = callUniqueId;

        const [callerVerify, receiverVerify] = await Promise.all([
          User.updateOne(
            { _id: caller._id, isOnline: true, isBusy: false, callId: null },
            { $set: { isBusy: true, callId: callHistory._id.toString() } }
          ),
          Listener.updateOne(
            { _id: receiver._id, isFake: false, isBlock: false, isOnline: true, isBusy: false, callId: null, [availabilityField]: true },
            { $set: { isBusy: true, callId: callHistory._id.toString() } }
          ),
        ]);

        if (callerVerify.modifiedCount > 0 && receiverVerify.modifiedCount > 0) {
          const dataOfVideoCall = {
            callType: callType.trim().toLowerCase(),
            callerId: caller._id,
            receiverId: receiver._id,
            callerImage: caller.profilePic,
            callernickName: caller.nickName,
            callerfullName: caller.fullName,
            receiverName: receiver.name,
            receiverImage: receiver.image,
            callId: callHistory._id,
            callMode: "random",
            callerRole,
            receiverRole,
          };

          io.in("globalRoom:" + receiver._id.toString()).emit("incomingCall", dataOfVideoCall);
          io.in("globalRoom:" + caller._id.toString()).emit("callEstablished", dataOfVideoCall);

          if (receiver.isNotificationEnabled && !receiver.isBlock && receiver.fcmToken) {
            const callerName = dataOfVideoCall.callerfullName?.trim() || dataOfVideoCall.callernickName?.trim() || "Someone";
            const isVideo = callType?.trim().toLowerCase() === "video";
            const notificationTitle = isVideo ? `🎥 Incoming Video Call Request` : `📞 Incoming Audio Call Request`;
            const notificationBody = isVideo
              ? `📲 Random video call from ${callerName}. Join now! 💫`
              : `📞 ${callerName} wants a random voice chat. Tap to connect! 🔊`;

            const payload = {
              token: receiver.fcmToken,
              android: { priority: "high" },
              apns: { headers: { "apns-priority": "10" } },
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
                callMode: dataOfVideoCall.callMode || "random",
                callerRole: dataOfVideoCall.callerRole || "",
                receiverRole: dataOfVideoCall.receiverRole || "",
              },
            };

            const adminInstance = await admin;
            adminInstance.messaging().send(payload)
              .then(async (response) => {
                console.log("📨 Random call FCM sent:", response);
                const notification = new Notification();
                if (receiverRole === "user") notification.userId = receiver._id;
                else if (receiverRole === "listener") notification.listenerId = receiver._id;
                notification.title = notificationTitle;
                notification.message = notificationBody;
                notification.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                await notification.save();
              })
              .catch(e => console.error("⚠️ Random call FCM error:", e));
          }

          callHistory.callerRole = "user";
          callHistory.type = callType?.trim()?.toLowerCase() === "audio" ? 5 : 6;
          callHistory.callType = callType?.trim()?.toLowerCase();
          callHistory.isRandom = true;
          callHistory.userId = caller._id;
          callHistory.listenerId = receiver._id;
          callHistory.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

          // FIX 4: Added `new` keyword to Randomcall constructor
          await Promise.all([
            callHistory.save(),
            new Randomcall({ caller: caller._id }).save(),
          ]);
        } else {
          io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", { message: "Call setup failed.", isBusy: true });
          if (callerVerify.modifiedCount > 0) await User.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } });
          if (receiverVerify.modifiedCount > 0) await Listener.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } });
        }
      } else {
        io.in("globalRoom:" + caller._id.toString()).emit("incomingRingingStarted", { message: "Receiver unavailable.", isBusy: true });
      }
    } catch (error) {
      console.error("❌ [incomingRingingStarted] Error:", error);
    }
  });

  // ─────────────────────────────────────────
  // DISCONNECT
  // ─────────────────────────────────────────
  socket.on("disconnect", async (reason) => {
    try {
      console.log(`Socket disconnected: ${id} - Reason: ${reason}`);

      if (globalRoom) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const sockets = await io.in(globalRoom).fetchSockets();
        console.log("Active sockets in room after delay:", sockets.length);

        if (sockets.length === 0) {
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
    } catch (error) {
      console.error("❌ [disconnect] Error:", error);
    }
  });
});