// routes/pincodeRoutes.js
const express = require("express");
const router = express.Router();
const { checkCompanyCat, autocompleteCompanies, CreateIndex } = require("../controllers/companyController"); // Import the controller function

// companyCategoryRoutes.js
const multer = require("multer");

// Setup Multer for file uploads
const upload = multer({ dest: "uploads/" }); // File will be stored temporarily in "uploads/" folder


const { uploadCompanyCategories } = require('../controllers/companyController'); // Correct path to controller

// Define the route
router.post('/uploadCompanies',upload.single("file"), uploadCompanyCategories); 
router.get("/checkCompanyCat", checkCompanyCat);
router.get("/autocompleteCompany", autocompleteCompanies);
router.get("/createAnIndex",  CreateIndex)

module.exports = router;
