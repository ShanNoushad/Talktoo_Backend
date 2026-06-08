//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//controller
const SettingController = require("../../controllers/user/setting.controller");

//get setting
route.get("/fetchAppSettingsData", validateUserAuthToken, checkAccessWithSecretKey(), SettingController.fetchAppSettingsData);

//get setting
route.get("/getAppConfiguration", checkAccessWithSecretKey(), SettingController.getAppConfiguration);

module.exports = route;
