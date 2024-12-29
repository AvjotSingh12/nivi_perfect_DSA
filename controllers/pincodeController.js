// instance from your config
const admin = require('firebase-admin');
const {db} = require('../config/firebaseConfig');
const checkPincode= async (req, res) => {
    const userPincode = req.query.pincode; // Get the pincode from query parameters

    if (!userPincode) {
        return res.status(400).json({ error: 'Pincode is required' });
    }

    try {
        const banksSnapshot = await db.collection('pincode_services').get();
        let matchingBanks = [];

        banksSnapshot.forEach(doc => {
            const pincodes = doc.data().pincode; // Get the 'pincode' field as a string

            if (pincodes) {
                // Convert the string into an array of pincodes
                const pincodeArray = pincodes
                    .replace(/"/g, '') // Remove all double quotes
                    .split(',')        // Split by commas
                    .map(p => p.trim()); // Trim whitespace around each pincode

                // Check if the user's pincode exists in the array
                if (pincodeArray.includes(userPincode)) {
                    matchingBanks.push({ bank: doc.id, Logo: doc.data().logo}); // Add the matching document ID to the list
                }
            }
        });

        // Respond with matching banks or a message if no match is found
        if (matchingBanks.length > 0) {
            return res.json({ message: 'Banks found', banks: matchingBanks });
        } else {
            return res.json({ message: 'No banks found for this pincode. Add a new bank for this pincode.' });
        }
    } catch (error) {
        console.error('Error fetching data from Firestore:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    checkPincode,
};