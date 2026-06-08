//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const TalkTopicController = require("../../controllers/user/talkTopic.controller");

//get talk topic list
route.get("/getTalkTopics", checkAccessWithSecretKey(), TalkTopicController.getTalkTopics);

module.exports = route;
