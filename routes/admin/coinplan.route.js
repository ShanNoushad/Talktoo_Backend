//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const CoinplanController = require("../../controllers/admin/coinplan.controller");

//create a new coin plan
route.post("/addCoinPlan", checkAccessWithSecretKey(), CoinplanController.addCoinPlan);

//update an existing coin plan
route.patch("/editCoinPlan", checkAccessWithSecretKey(), CoinplanController.editCoinPlan);

//toggle coin plan status (isActive or isPopular)
route.patch("/toggleCoinPlanField", checkAccessWithSecretKey(), CoinplanController.toggleCoinPlanField);

//retrieve all coin plans
route.get("/listCoinPlans", checkAccessWithSecretKey(), CoinplanController.listCoinPlans);

//get coinplan histories of users (admin earning)
route.get("/getCoinPurchaseHistory", checkAccessWithSecretKey(), CoinplanController.getCoinPurchaseHistory);

//delete a coin plan
route.delete("/deleteCoinPlan", checkAccessWithSecretKey(), CoinplanController.deleteCoinPlan);

module.exports = route;
