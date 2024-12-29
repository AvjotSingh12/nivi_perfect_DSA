// routes/pincodeRoutes.js
const express = require("express");
const router = express.Router();
const { checkCompanyCat, autoCompleteCompany } = require("../controllers/companyController"); // Import the controller function



// Define the route and link it to the controller function
router.get("/checkCompanyCat", checkCompanyCat);
router.get("/autocompleteCompany", autoCompleteCompany);

module.exports = router;
