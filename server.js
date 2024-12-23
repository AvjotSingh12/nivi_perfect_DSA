const express = require('express');
require('dotenv').config();
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert({
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    }),
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Endpoint to check pincode
app.get('/checkPincode', async (req, res) => {
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
});

// Endpoint to check company category
app.get('/checkCompanyCat', async (req, res) => {
    const inputCompany = req.query.Company; // Get the company name from query parameters

    if (!inputCompany) {
        return res.status(400).json({ error: 'Company is required' });
    }

    try {
        const banksSnapshot = await db.collection('company_categories').get();
        let matchingCategories = [];

        // Loop through each category document
        for (const doc of banksSnapshot.docs) {
            const listSnapshot = await doc.ref.collection('company_list').get(); // Get the sub-collection `company_list`

            // Loop through each chunk in the `company_list` sub-collection
            for (const chunkDoc of listSnapshot.docs) {
                const chunkData = chunkDoc.data().companies; // Get the companies list

                if (chunkData) {
                    // Convert the string into an array of company names
                    const companyArray = chunkData
                        .replace(/"/g, '') // Remove all double quotes
                        .split(',')        // Split by commas
                        .map(c => c.trim()); // Trim whitespace around each company name

                    // Check if the input company exists in the array
                    if (companyArray.includes(inputCompany)) {
                      let inputString = chunkDoc.id;
                      let trimmedString = inputString.split('_')[0] + ' ' + inputString.split('_')[1];
                        matchingCategories.push({
                            bank: doc.id,         // Category document ID
                            category: trimmedString // Chunk document ID
                        });
                    }
                }
            }
        }

        // Respond with matching categories or a message if no match is found
        if (matchingCategories.length > 0) {
            return res.json({ message: 'Company found in categories', categories: matchingCategories });
        } else {
            return res.json({ message: 'No category found for this company. Add the company to a category.' });
        }
    } catch (error) {
        console.error('Error fetching data from Firestore:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
 
// app.get('/checkCompany', async (req, res) => {
//     const userInput = req.query.query; // Get the user input (company name prefix) from query parameters

//     if (!userInput) {
//         return res.status(400).json({ error: 'Company name prefix is required' });
//     }

//     try {
//         const companiesSnapshot = await db.collection('Test').limit(100).get(); // Assuming the companies are stored in the 'Test' collection
//         let matchingCompanies = [];

//         companiesSnapshot.forEach(doc => {
//             const companyList = doc.data().CompanyList; // Get the 'CompanyList' field

//             if (companyList) {
//                 // Remove quotes and split by commas
//                 const companies = companyList
//                     .replace(/"/g, '')        // Remove all double quotes
//                     .split(',')               // Split by commas
//                     .map(company => company.trim()); // Trim whitespace around each company name

//                 // Filter the companies that start with the user input
//                 companies.forEach(companyName => {
//                     if (companyName.toLowerCase().startsWith(userInput.toLowerCase())) {
//                         matchingCompanies.push({ company: companyName }); // Add the matching company name to the list
//                     }
//                 });
//             }
//         });

//         // Respond with matching companies or a message if no match is found
//         if (matchingCompanies.length > 0) {
//             return res.json({ message: 'Companies found', companies: matchingCompanies });
//         } else {
//             return res.json({ message: 'No companies found for this prefix. Add a new company for this prefix.' });
//         }
//     } catch (error) {
//         console.error('Error fetching data from Firestore:', error);
//         return res.status(500).json({ error: 'Internal server error' });
//     }
// });
app.get('/checkCompany', async (req, res) => {
    const userInput = req.query.query; // Get the user input (company name prefix) from query parameters

    if (!userInput) {
        return res.status(400).json({ error: 'Company name prefix is required' });
    }

    try {
        const companiesSnapshot = await db.collection('Test')
            .limit(100) // Limit the number of documents fetched to prevent unnecessary load
            .get(); // Fetch data from Firestore

        let matchingCompanies = [];
        const userInputLower = userInput.toLowerCase(); // Preprocess the user input to lowercase for efficient comparison

        companiesSnapshot.forEach(doc => {
            const companyList = doc.data().CompanyList; // Get the 'CompanyList' field

            if (companyList) {
                // Remove quotes, split by commas, and preprocess to lowercase
                const companies = companyList
                    .replace(/"/g, '')        // Remove all double quotes
                    .split(',')               // Split by commas
                    .map(company => company.trim().toLowerCase()); // Convert to lowercase and trim whitespace

                // Filter the companies that start with the user input
                companies.forEach(companyName => {
                    if (companyName.startsWith(userInputLower)) {
                        matchingCompanies.push({ company: companyName }); // Add the matching company name to the list
                    }
                });
            }
        });

        // Respond with matching companies or a message if no match is found
        if (matchingCompanies.length > 0) {
            return res.json({ message: 'Companies found', companies: matchingCompanies });
        } else {
            return res.json({ message: 'No companies found for this prefix. Add a new company for this prefix.' });
        }
    } catch (error) {
        console.error('Error fetching data from Firestore:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// Define the port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

