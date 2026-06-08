//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//controller
const ChatController = require("../../controllers/user/chat.controller");

//send message ( image or audio )
route.post(
  "/sendChatMessage",
  validateUserAuthToken,
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  ChatController.sendChatMessage
);

//get old chat
route.get("/retrieveChatHistory", validateUserAuthToken, ChatController.retrieveChatHistory);

module.exports = route;
