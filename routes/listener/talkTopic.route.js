//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const TalkTopicController = require("../../controllers/listener/talkTopic.controller");

//get talk topic list
route.get("/listTalkTopics", checkAccessWithSecretKey(), TalkTopicController.listTalkTopics);

module.exports = route;
