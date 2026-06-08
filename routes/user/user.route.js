//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//verify auth token
const verifyAuthToken = require("../../middleware/verifyAuthToken.middleware");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//controller
const UserController = require("../../controllers/user/user.controller");

//check the user is exists or not ( quick or email-password )
route.post("/verifyUserExistence", checkAccessWithSecretKey(), UserController.verifyUserExistence);

//user login or sign up
route.post("/authenticateOrRegisterUser", verifyAuthToken, checkAccessWithSecretKey(), UserController.authenticateOrRegisterUser);

//update user's profile
route.patch("/updateUserProfile", validateUserAuthToken, checkAccessWithSecretKey(), upload.single("profilePic"), UserController.updateUserProfile);

//get user's profile
route.get("/getUserProfile", validateUserAuthToken, checkAccessWithSecretKey(), UserController.getUserProfile);

//update password
route.patch("/modifyPassword", validateUserAuthToken, checkAccessWithSecretKey(), UserController.modifyPassword);

//set password ( forgot password )
route.patch("/resetPassword", checkAccessWithSecretKey(), UserController.resetPassword);

//toggling the user's notification permission status
route.patch("/modifyNotificationPermission", checkAccessWithSecretKey(), UserController.modifyNotificationPermission);

//get user coin
route.get("/retrieveUserCoinBalance", checkAccessWithSecretKey(), UserController.retrieveUserCoinBalance);

//get listener languages
route.get("/getAllListenerLanguages", checkAccessWithSecretKey(), UserController.getAllListenerLanguages);

//update user interest for listener-matching
route.patch("/saveUserInterests", checkAccessWithSecretKey(), UserController.saveUserInterests);

//delete user account
route.delete("/deleteSelfAccount", checkAccessWithSecretKey(), UserController.deleteSelfAccount);

// GET Firebase UID using Device UUID
route.get("/getfirebaseIdByDeviceId", checkAccessWithSecretKey(), UserController.getfirebaseIdByDeviceId);

// CREATE Firebase Custom Token using Firebase UID
route.get("/generateFirebaseCustomToken", checkAccessWithSecretKey(), UserController.generateFirebaseCustomToken);

module.exports = route;
