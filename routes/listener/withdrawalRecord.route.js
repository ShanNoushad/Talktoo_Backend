//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const WithdrawalRecordController = require("../../controllers/listener/withdrawalRecord.controller");

//submit withdraw record
route.post("/addWithdrawalRecord", checkAccessWithSecretKey(), WithdrawalRecordController.addWithdrawalRecord);

//get withdraw records
route.get("/getPayoutRecords", checkAccessWithSecretKey(), WithdrawalRecordController.getPayoutRecords);

module.exports = route;
