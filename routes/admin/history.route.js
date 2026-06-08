//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const HistoryController = require("../../controllers/admin/history.controller");

//get coin history ( user )
route.get("/getWalletHistory", checkAccessWithSecretKey(), HistoryController.getWalletHistory);

//get call history ( user )
route.get("/listCallRecords", checkAccessWithSecretKey(), HistoryController.listCallRecords);

//get coinplan history ( user )
route.get("/retrievePurchaseLog", checkAccessWithSecretKey(), HistoryController.retrievePurchaseLog);

//get coin history ( listener )
route.get("/fetchCoinTransactions", checkAccessWithSecretKey(), HistoryController.fetchCoinTransactions);

//get call history ( listener )
route.get("/fetchCallHistory", checkAccessWithSecretKey(), HistoryController.fetchCallHistory);

module.exports = route;
