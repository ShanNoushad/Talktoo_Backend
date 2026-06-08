//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const HistoryController = require("../../controllers/user/history.controller");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//get coin history
route.get("/getCoinWalletRecords", validateUserAuthToken, checkAccessWithSecretKey(), HistoryController.getCoinWalletRecords);

//get call history
route.get("/getCallRecords", validateUserAuthToken, checkAccessWithSecretKey(), HistoryController.getCallRecords);

//get purchase coinplan history
route.get("/getCoinPackagePurchaseHistory", validateUserAuthToken, checkAccessWithSecretKey(), HistoryController.getCoinPackagePurchaseHistory);

module.exports = route;
