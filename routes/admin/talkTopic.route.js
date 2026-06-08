//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const TalkTopicController = require("../../controllers/admin/talkTopic.controller");

//create TalkTopic
route.post("/createTalkTopic", checkAccessWithSecretKey(), TalkTopicController.createTalkTopic);

//update TalkTopic
route.patch("/updateTalkTopic", checkAccessWithSecretKey(), TalkTopicController.updateTalkTopic);

//get all TalkTopics
route.get("/getTalkTopics", checkAccessWithSecretKey(), TalkTopicController.getTalkTopics);

//get all TalkTopics (dropdown)
route.get("/fetchTalkTopicMetrics", checkAccessWithSecretKey(), TalkTopicController.fetchTalkTopicMetrics);

//delete TalkTopic
route.delete("/deleteTalkTopic", checkAccessWithSecretKey(), TalkTopicController.deleteTalkTopic);

module.exports = route;
