//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const HistoryController = require("../../controllers/listener/history.controller");

//get call history
route.get("/retrieveCallHistory", checkAccessWithSecretKey(), HistoryController.retrieveCallHistory);

//get coin history
route.get("/fetchCoinWalletHistory", checkAccessWithSecretKey(), HistoryController.fetchCoinWalletHistory);

module.exports = route;
