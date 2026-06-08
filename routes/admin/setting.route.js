//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const SettingController = require("../../controllers/admin/setting.controller");

//update setting
route.patch("/modifySetting", checkAccessWithSecretKey(), SettingController.modifySetting);

//update setting switch
route.patch("/toggleAppSetting", checkAccessWithSecretKey(), SettingController.toggleAppSetting);

//get setting
route.get("/getSettingsData", checkAccessWithSecretKey(), SettingController.getSettingsData);

module.exports = route;
