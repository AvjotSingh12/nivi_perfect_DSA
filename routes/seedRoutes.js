// const express = require('express');
// const multer = require('multer'); // Import multer
// const { addBanks } = require('../controllers/seedBanks');

// const router = express.Router();

// // Configure multer for file uploads
// const upload = multer({ dest: 'uploads/'}); // Files will be temporarily stored in the 'uploads' folder

// // Route to seed banks
// router.post('/addBanks', upload.single("file"), addBanks); // Use multer middleware

// module.exports = router;

const express = require('express');
const multer = require('multer');
const path = require('path');
const { addBanks, addPanIndiaField } = require('../controllers/seedBanks');

const router = express.Router();

// Configure Multer for file uploads
const upload = multer({
    dest: path.join(__dirname, '../uploads'), // Store uploaded files in `uploads` directory
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed!'), false);
        }
    }
});

// Route to handle CSV uploads

router.put('/updateBanks' , addPanIndiaField);
router.post('/addBanks', upload.single('file'), addBanks);

module.exports = router;
