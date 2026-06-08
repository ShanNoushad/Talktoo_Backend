//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const UserController = require("../../controllers/admin/user.controller");

//get users
route.get("/listRegisteredUsers", checkAccessWithSecretKey(), UserController.listRegisteredUsers);

//toggle user's block status
route.patch("/toggleUserBlock", checkAccessWithSecretKey(), UserController.toggleUserBlock);

//get users ( drop - down )
route.get("/retrieveUserList", checkAccessWithSecretKey(), UserController.retrieveUserList);

//admin can add or deduct coins from a user's wallet
route.patch("/adjustUserCoins", checkAccessWithSecretKey(), UserController.adjustUserCoins);

module.exports = route;
