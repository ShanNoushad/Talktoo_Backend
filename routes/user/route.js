//express
const express = require("express");
const route = express.Router();

//require user's route.js
const user = require("./user.route");
const talkTopic = require("./talkTopic.route");
const listener = require("./listener.route");
const faq = require("./faq.route");
const identityProof = require("./identityProof.route");
const coinplan = require("./coinplan.route");
const chat = require("./chat.route");
const chatTopic = require("./chatTopic.route");
const rating = require("./rating.route");
const history = require("./history.route");
const notification = require("./notification.route");
const setting = require("./setting.route");

//exports user's route.js
route.use("/", user);
route.use("/talkTopic", talkTopic);
route.use("/listener", listener);
route.use("/faq", faq);
route.use("/identityProof", identityProof);
route.use("/coinplan", coinplan);
route.use("/chat", chat);
route.use("/chatTopic", chatTopic);
route.use("/rating", rating);
route.use("/history", history);
route.use("/notification", notification);
route.use("/setting", setting);

module.exports = route;
