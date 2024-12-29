// routes/pincodeRoutes.js
const express = require("express");
const router = express.Router();
const { checkReferrelcode } = require("../controllers/userController"); // Import the controller function



// Define the route and link it to the controller function
router.get("/checkReferrel", checkReferrelcode);

module.exports = router;
