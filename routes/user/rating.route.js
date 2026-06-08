//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const RatingController = require("../../controllers/user/rating.controller");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//rating listener ( after call )
route.post("/submitListenerReview", validateUserAuthToken, checkAccessWithSecretKey(), RatingController.submitListenerReview);

//get listener's reviews
route.get("/fetchListenerReviews", checkAccessWithSecretKey(), RatingController.fetchListenerReviews);

module.exports = route;
