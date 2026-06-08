//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const FaqController = require("../../controllers/admin/faq.controller");

//create FAQ
route.post("/createFaq", checkAccessWithSecretKey(), FaqController.createFaq);

//update FAQ
route.patch("/updateFaq", checkAccessWithSecretKey(), FaqController.updateFaq);

//get all FAQs
route.get("/getFaqs", checkAccessWithSecretKey(), FaqController.getFaqs);

//delete FAQ
route.delete("/deleteFaq", checkAccessWithSecretKey(), FaqController.deleteFaq);

module.exports = route;
