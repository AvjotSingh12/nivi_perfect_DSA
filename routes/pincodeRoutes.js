// routes/pincodeRoutes.js
const express = require("express");
const router = express.Router();
const { checkPincode } = require("../controllers/pincodeController"); // Import the controller function



// Define the route and link it to the controller function
router.get("/checkPincode", checkPincode);

module.exports = router;
