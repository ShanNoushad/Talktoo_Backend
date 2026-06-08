//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//controller
const ChatTopicController = require("../../controllers/user/chatTopic.controller");

//search listener (chat)
route.get("/findChattedListenersBySearch", validateUserAuthToken, checkAccessWithSecretKey(), ChatTopicController.findChattedListenersBySearch);

//get chat thumb list
route.get("/getUserChatList", validateUserAuthToken, checkAccessWithSecretKey(), ChatTopicController.getUserChatList);

module.exports = route;
