//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const NotificationController = require("../../controllers/listener/notification.controller");

//get notification list
route.get("/fetchNotifications", checkAccessWithSecretKey(), NotificationController.fetchNotifications);

//clear all notification
route.delete("/resetNotificationHistory", checkAccessWithSecretKey(), NotificationController.resetNotificationHistory);

module.exports = route;
