//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const ChatController = require("../../controllers/listener/chat.controller");

//send message ( image or audio )
route.post(
  "/dispatchChatMessage",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  ChatController.dispatchChatMessage
);

//get old chat
route.get("/getChatHistory", checkAccessWithSecretKey(), ChatController.getChatHistory);

module.exports = route;
