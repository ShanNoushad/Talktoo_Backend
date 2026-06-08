//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//controller
const ListenerController = require("../../controllers/admin/listener.controller");

//retrive listener requests
route.get("/getListenerRequests", checkAccessWithSecretKey(), ListenerController.getListenerRequests);

//accept Or decline listener request
route.patch("/handleListenerRequest", checkAccessWithSecretKey(), ListenerController.handleListenerRequest);

//add listener
route.post(
  "/createListener",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 10 },
  ]),
  ListenerController.createListener
);

//update listener
route.patch(
  "/updateListenerProfile",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 10 },
  ]),
  ListenerController.updateListenerProfile
);

//get listener
route.get("/fetchListeners", checkAccessWithSecretKey(), ListenerController.fetchListeners);

//delete listener
route.delete("/deleteListenerProfile", checkAccessWithSecretKey(), ListenerController.deleteListenerProfile);

//toggle block status
route.patch("/updateBlockStatus", checkAccessWithSecretKey(), ListenerController.updateBlockStatus);

module.exports = route;
