//express
const express = require("express");
const route = express.Router();

//admin index.js
const admin = require("./admin/route");

//user index.js
const user = require("./user/route");

//listener index.js
const listener = require("./listener/route");

route.use("/admin", admin);
route.use("/user", user);
route.use("/listener", listener);

module.exports = route;


