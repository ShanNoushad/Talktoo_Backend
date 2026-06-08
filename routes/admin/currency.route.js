const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const currencyController = require("../../controllers/admin/currency.controller");

//create currency
route.post("/insertCurrency", checkAccessWithSecretKey(), currencyController.insertCurrency);

//update currency
route.patch("/updateCurrency", checkAccessWithSecretKey(), currencyController.updateCurrency);

//get currencies
route.get("/fetchCurrency", checkAccessWithSecretKey(), currencyController.fetchCurrency);

//delete currency
route.delete("/disableCurrency", checkAccessWithSecretKey(), currencyController.disableCurrency);

//set default currency
route.patch("/setDefaultCurrency", checkAccessWithSecretKey(), currencyController.setDefaultCurrency);

//get default currency
route.get("/fetchDefaultCurrency", checkAccessWithSecretKey(), currencyController.fetchDefaultCurrency);

module.exports = route;
