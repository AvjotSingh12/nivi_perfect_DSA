const Bank = require('../models/bankModel');

// Controller to seed dummy banks
exports.seedBanks = async (req, res) => {
  try {
    const banks = [
      { bankName: 'Bank A', address: '123 Street, City A', contact_info: 'contactA@example.com' },
      { bankName: 'Bank B', address: '456 Avenue, City B', contact_info: 'contactB@example.com' },
      { bankName: 'Bank C', address: '789 Road, City C', contact_info: 'contactC@example.com' },
    ];

    await Bank.insertMany(banks);
    res.status(201).json({ message: 'Dummy banks added successfully!' });
  } catch (error) {
    console.error('Error seeding banks:', error);
    res.status(500).json({ error: 'Error seeding banks' });
  }
};
