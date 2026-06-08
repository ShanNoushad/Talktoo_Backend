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
const ListenerController = require("../../controllers/listener/listener.controller");

//update profile
route.patch("/modifyListenerProfile", checkAccessWithSecretKey(), upload.single("image"), ListenerController.modifyListenerProfile);

//update random call status
route.patch("/toggleListenerCall", checkAccessWithSecretKey(), ListenerController.toggleListenerCall);

//get profile
route.get("/fetchListenerProfile", checkAccessWithSecretKey(), ListenerController.fetchListenerProfile);

//toggle listener notification permission
route.patch("/updateNotifyPermission", checkAccessWithSecretKey(), ListenerController.updateNotifyPermission);

//get listener coin
route.get("/getListenerCoinBalance", checkAccessWithSecretKey(), ListenerController.getListenerCoinBalance);

//delete listener account
route.delete("/deleteListenerAccount", checkAccessWithSecretKey(), ListenerController.deleteListenerAccount);

//get user's profile
route.get("/getProfileByUserId", checkAccessWithSecretKey(), ListenerController.getProfileByUserId);

module.exports = route;
