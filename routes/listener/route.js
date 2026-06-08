//express
const express = require("express");
const route = express.Router();

//require listener's route.js
const faq = require("./faq.route");
const paymentOption = require("./paymentOption.route");
const talkTopic = require("./talkTopic.route");
const chatTopic = require("./chatTopic.route");
const chat = require("./chat.route");
const listener = require("./listener.route");
const history = require("./history.route");
const withdrawalRecord = require("./withdrawalRecord.route");
const notification = require("./notification.route");
const setting = require("./setting.route");

//exports listener's route.js
route.use("/faq", faq);
route.use("/paymentOption", paymentOption);
route.use("/talkTopic", talkTopic);
route.use("/chatTopic", chatTopic);
route.use("/chat", chat);
route.use("/", listener);
route.use("/history", history);
route.use("/withdrawalRecord", withdrawalRecord);
route.use("/notification", notification);
route.use("/setting", setting);

module.exports = route;
