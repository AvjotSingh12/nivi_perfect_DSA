const admin = require('firebase-admin');
const {db} = require('../config/firebaseConfig');


const csv = require("csv-parser");
const Bank = require("../models/bankModel");
const Pincode = require("../models/pincodeModel");
const xlsx = require("xlsx");

const uploadPincodes = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path; // Path to the uploaded Excel file

    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get the first sheet
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convert to JSON

    if (!sheetData.length) {
      return res.status(400).json({ message: "Excel file is empty" });
    }

    const bankMap = new Map(); // To store bank data (prevents duplicate checks)
    const pincodeMap = new Map(); // To store pincodes in bulk updates

    for (const entry of sheetData) {
      const bankName = entry["BANK NAME"]?.trim();
      const pincodesRaw = entry["PINCODE"]?.toString().trim();

      if (!bankName || !pincodesRaw) {
        console.log(`Skipping row with missing data: ${JSON.stringify(entry)}`);
        continue;
      }

      const pincodeArray = pincodesRaw.split(",").map((code) => code.trim());

      if (!bankMap.has(bankName)) {
        bankMap.set(bankName, []);
      }
      bankMap.get(bankName).push(...pincodeArray);
    }

    const bankNames = [...bankMap.keys()];

    // Find existing banks in one query
    const existingBanks = await Bank.find({ bankNames: { $in: bankNames } });
    const existingBankMap = new Map(existingBanks.map((bank) => [bank.bankNames, bank._id]));

    const newBanks = [];
    const bulkUpdates = [];

    for (const [bankName, pincodes] of bankMap.entries()) {
      let bankId = existingBankMap.get(bankName);

      if (!bankId) {
        newBanks.push({ bankNames: bankName });
      } else {
        if (!pincodeMap.has(bankId)) {
          pincodeMap.set(bankId, new Set());
        }
        pincodes.forEach((pincode) => pincodeMap.get(bankId).add(pincode));
      }
    }

    // Insert new banks in bulk
    if (newBanks.length > 0) {
      const insertedBanks = await Bank.insertMany(newBanks);
      insertedBanks.forEach((bank) => {
        pincodeMap.set(bank._id, new Set(bankMap.get(bank.bankNames)));
      });
    }

    // Prepare bulk update operations for pincodes
    for (const [bankId, pincodeSet] of pincodeMap.entries()) {
      bulkUpdates.push({
        updateOne: {
          filter: { bank_id: bankId },
          update: { $addToSet: { serviceable_pincodes: { $each: [...pincodeSet] } } },
          upsert: true,
        },
      });
    }

    // Perform bulk update for pincodes
    if (bulkUpdates.length > 0) {
      await Pincode.bulkWrite(bulkUpdates);
    }

    fs.unlinkSync(filePath); // Delete uploaded file

    res.status(201).json({ message: "Excel data uploaded successfully with bulk insert!" });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ message: error.message });
  }
};


// const uploadPincodes = async (req, res) => {
//   try {
//     if (!req.file || !req.file.path) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     const filePath = req.file.path; // Path to the uploaded Excel file

//     // Read the Excel file
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0]; // Get the first sheet
//     const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convert to JSON

//     for (const entry of sheetData) {
//       const bankName = entry["BANK NAME"]?.trim(); // Ensure proper column name
//       const pincodesRaw = entry["PINCODE"]?.toString().trim(); // Convert to string

//       if (!bankName || !pincodesRaw) {
//         console.log(`Skipping row with missing data: ${JSON.stringify(entry)}`);
//         continue;
//       }

//       const pincodeArray = pincodesRaw.split(",").map((code) => code.trim());

//       let bank = await Bank.findOne({ bankNames: bankName });

//       if (!bank) {
//         console.log(`Bank not found: ${bankName}. Creating a new bank entry.`);

//         bank = await Bank.create({ bankNames: bankName });
//       }

//       // Ensure Pincode entry exists for this bank
//       let pincodeEntry = await Pincode.findOne({ bank_id: bank._id });

//       if (!pincodeEntry) {
//         // If no entry exists, create a new one
//         await Pincode.create({
//           bank_id: bank._id,
//           serviceable_pincodes: pincodeArray,
//         });
//       } else {
//         // Add only new pincodes to the existing list
//         await Pincode.updateOne(
//           { bank_id: bank._id },
//           { $addToSet: { serviceable_pincodes: { $each: pincodeArray } } }
//         );
//       }
//     }

//     fs.unlinkSync(filePath); // Delete the uploaded file

//     res.status(201).json({ message: "Excel data uploaded successfully!" });
//   } catch (error) {
//     console.error("Error processing file:", error);
//     res.status(500).json({ message: error.message });
//   }
// };


module.exports = uploadPincodes;

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
    checkPincode,uploadPincodes
};