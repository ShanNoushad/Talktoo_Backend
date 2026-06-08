//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const FaqController = require("../../controllers/user/faq.controller");

//get all FAQs
route.get("/listFaqs", checkAccessWithSecretKey(), FaqController.listFaqs);

module.exports = route;
