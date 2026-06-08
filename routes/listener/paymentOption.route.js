//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const PaymentOptionController = require("../../controllers/listener/paymentOption.controller");

//get all Payment Options
route.get("/getAvailablePaymentOptions", checkAccessWithSecretKey(), PaymentOptionController.getAvailablePaymentOptions);

module.exports = route;
