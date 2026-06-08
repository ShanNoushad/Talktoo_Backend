//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const FaqController = require("../../controllers/listener/faq.controller");

//get all FAQs
route.get("/retrieveFaqList", checkAccessWithSecretKey(), FaqController.retrieveFaqList);

module.exports = route;
