// routes/pincodeRoutes.js

const express = require("express");
const router = express.Router();
const { checkPincode, uploadPincodes } = require("../controllers/pincodeController"); // Import controller functions
const multer = require("multer");

// Setup Multer for file uploads
const upload = multer({ dest: "uploads/" }); // File will be stored temporarily in "uploads/" folder

// Route to check pincode
router.get("/checkPincode", checkPincode);

// Route to upload pincodes via CSV file
router.post("/uploadPincodes", upload.single("file"), uploadPincodes);

module.exports = router;
