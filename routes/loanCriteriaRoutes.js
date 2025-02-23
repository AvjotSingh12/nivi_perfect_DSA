const express = require('express');
const multer = require('multer');
const loanCriteriaController = require('../controllers/loanCriteriaController');

const router = express.Router();

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' }); // Temp folder for uploaded files

// Route to upload loan criteria CSV file
// //router.post('/uploadLoanCriteria', upload.single('file'), loanCriteriaController.uploadLoanCriteria);
router.post('/uploadPersonLoanCriteria', upload.single('file'), loanCriteriaController.uploadPersonalLoanCriteria);
// router.post('/uploadPersonLoanCriteria', upload.single('file'), (req, res, next) => {
//     console.log("Received file:", req.file);
//     next();
//   }, loanCriteriaController.uploadPersonalLoanCriteria);
router.post('/uploadVehicleLoanCriteria', upload.single('file'), loanCriteriaController.uploadVehicleLoanCriteria);
router.post('/uploadHomeLoanCriteria', upload.single('file'), loanCriteriaController.uploadHomeLoanCriteria);
router.post('/uploadBusinessLoanCriteria', upload.single('file'), loanCriteriaController.uploadBusinessLoanCriteria);

module.exports = router;
