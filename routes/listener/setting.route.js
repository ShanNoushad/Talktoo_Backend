//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const SettingController = require("../../controllers/listener/setting.controller");

//get setting
route.get("/retrieveAppSettingsData", checkAccessWithSecretKey(), SettingController.retrieveAppSettingsData);

module.exports = route;
