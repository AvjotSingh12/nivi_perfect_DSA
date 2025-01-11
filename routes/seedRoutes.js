const express = require('express');
const { seedBanks } = require('../controllers/seedBanks');

const router = express.Router();

// Route to seed banks
router.post('/seedBanks', seedBanks);

module.exports = router;
