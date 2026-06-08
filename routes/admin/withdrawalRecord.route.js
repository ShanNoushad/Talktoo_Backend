//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const WithdrawalRecordController = require("../../controllers/admin/withdrawalRecord.controller");

//get listener's withdrawal requests
route.get("/retrieveWithdrawalRecords", checkAccessWithSecretKey(), WithdrawalRecordController.retrieveWithdrawalRecords);

//toggle user's block status
route.patch("/updateWithdrawalRecords", checkAccessWithSecretKey(), WithdrawalRecordController.updateWithdrawalRecords);

module.exports = route;
