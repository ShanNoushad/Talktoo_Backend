//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const IdentityProofController = require("../../controllers/user/identityproof.controller");

//get all identity proof types
route.get("/listIdentityProofs", checkAccessWithSecretKey(), IdentityProofController.listIdentityProofs);

module.exports = route;
