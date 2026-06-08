//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../util/checkAccess");

//controller
const IdentityProofController = require("../../controllers/admin/identityproof.controller");

//add new identity proof type
route.post("/addIdentityProof", checkAccessWithSecretKey(), IdentityProofController.addIdentityProof);

//modify an existing identity proof type
route.patch("/modifyIdentityProof", checkAccessWithSecretKey(), IdentityProofController.modifyIdentityProof);

//get all identity proof types
route.get("/fetchIdentityProofs", checkAccessWithSecretKey(), IdentityProofController.fetchIdentityProofs);

//remove an identity proof type
route.delete("/removeIdentityProof", checkAccessWithSecretKey(), IdentityProofController.removeIdentityProof);

module.exports = route;
