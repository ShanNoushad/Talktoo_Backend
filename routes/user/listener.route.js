//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//validate user's access token
const validateUserAuthToken = require("../../middleware/validateUserAuthToken.middleware");

//controller
const ListenerController = require("../../controllers/user/listener.controller");

//become a listener
route.post(
  "/initiateListenerRequest",
  validateUserAuthToken,
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "identityProof", maxCount: 2 },
  ]),
  ListenerController.initiateListenerRequest
);

//check the status of a listener request
route.get("/verifyListenerRequestStatus", validateUserAuthToken, checkAccessWithSecretKey(), ListenerController.verifyListenerRequestStatus);

//get listener list
route.get("/fetchFilteredListeners", validateUserAuthToken, checkAccessWithSecretKey(), ListenerController.fetchFilteredListeners);

//get top listener list
route.get("/fetchTopListeners", validateUserAuthToken, checkAccessWithSecretKey(), ListenerController.fetchTopListeners);

//get listener profile
route.get("/getListenerProfile", validateUserAuthToken, checkAccessWithSecretKey(), ListenerController.getListenerProfile);

//get available listner
route.get("/retrieveAvailableListener", validateUserAuthToken, checkAccessWithSecretKey(), ListenerController.retrieveAvailableListener);

//get for you listener list
route.get("/fetchRecommendedListeners", validateUserAuthToken, checkAccessWithSecretKey(), ListenerController.fetchRecommendedListeners);

module.exports = route;
