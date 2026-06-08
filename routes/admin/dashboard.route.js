//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const DashboardController = require("../../controllers/admin/dashboard.controller");

//get dashboard count
route.get("/getAdminDashboardStats", checkAccessWithSecretKey(), DashboardController.getAdminDashboardStats);

//get chat analytic
route.get("/fetchChartMetrics", checkAccessWithSecretKey(), DashboardController.fetchChartMetrics);

//get new user
route.get("/getLatestUsers", checkAccessWithSecretKey(), DashboardController.getLatestUsers);

//get top spenders
route.get("/getLatestUsers", checkAccessWithSecretKey(), DashboardController.getLatestUsers);

//get top spenders
route.get("/getTopContributorsList", checkAccessWithSecretKey(), DashboardController.getTopContributorsList);

//get top performing listeners
route.get("/getTopPerformingListeners", checkAccessWithSecretKey(), DashboardController.getTopPerformingListeners);

module.exports = route;
