//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const PaymentOptionController = require("../../controllers/admin/paymentOption.controller");

//create Payment Option
route.post("/createPaymentOption", checkAccessWithSecretKey(), upload.single("image"), PaymentOptionController.createPaymentOption);

//update Payment Option
route.patch("/updatePaymentOption", checkAccessWithSecretKey(), upload.single("image"), PaymentOptionController.updatePaymentOption);

//toggle Payment Option Status (isActive)
route.patch("/togglePaymentOptionStatus", checkAccessWithSecretKey(), PaymentOptionController.togglePaymentOptionStatus);

//get all Payment Options
route.get("/getAllPaymentOptions", checkAccessWithSecretKey(), PaymentOptionController.getAllPaymentOptions);

//delete Payment Option
route.delete("/deletePaymentOption", checkAccessWithSecretKey(), PaymentOptionController.deletePaymentOption);

module.exports = route;
