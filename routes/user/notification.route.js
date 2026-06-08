//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const NotificationController = require("../../controllers/user/notification.controller");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//get notification list
route.get("/getNotificationHistory", validateUserAuthToken, checkAccessWithSecretKey(), NotificationController.getNotificationHistory);

//clear all notification
route.delete("/clearNotifications", validateUserAuthToken, checkAccessWithSecretKey(), NotificationController.clearNotifications);

module.exports = route;
