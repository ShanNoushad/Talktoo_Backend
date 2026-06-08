//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//controller
const CoinplanController = require("../../controllers/user/coinplan.controller");

//get coinPlan
route.get("/getAvailableCoinPackage", validateUserAuthToken, checkAccessWithSecretKey(), CoinplanController.getAvailableCoinPackage);

//purchase coinPlan ( coinPlan history )
route.post("/recordPurchasedCoinPlan", validateUserAuthToken, checkAccessWithSecretKey(), CoinplanController.recordPurchasedCoinPlan);

module.exports = route;
