const admin = require('firebase-admin');
const {db} = require('../config/firebaseConfig');

const Bank = require('../models/bankModel');
const fs = require("fs");
const csv = require("csv-parser");
const CompanyCategory = require("../models/companyCategoryModel"); // Update with your actual model path


const uploadCompanyCategories = async (req, res) => {
  try {
    const filePath = req.file.path; // Path of uploaded CSV file
    const companyCategoriesData = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        companyCategoriesData.push(row);
      })
      .on("end", async () => {
        try {
          const bulkOps = [];

          for (const entry of companyCategoriesData) {
            const bankName = entry["BANK NAME"];
            const categoryName = entry["CAT"];
            const minSalary = entry["MIN SALARY"];
            const companies = entry["COMPANY NAME"];

            if (!bankName || !categoryName || !companies || !minSalary) {
              console.error("Skipping row due to missing data:", entry);
              continue;
            }

            // Check if the bank exists
            const bank = await Bank.findOne({
              bankNames: new RegExp(`^${bankName.trim()}$`, "i"),
            });

            if (!bank) {
              console.log(`Bank does not exist, skipping: ${bankName}`);
              continue; // Skip if bank does not exist
            }

            // Convert companies string to an array
            const companyArray = companies.split(",").map((company) => company.trim());

            // Ensure the document exists with an empty `categories` array if not present
            await CompanyCategory.updateOne(
              { bank_id: bank._id },
              { $setOnInsert: { categories: [] } }, // Initialize categories if missing
              { upsert: true }
            );

            // Update or insert the category inside `categories` array
            await CompanyCategory.updateOne(
              { bank_id: bank._id, "categories.categoryName": categoryName },
              {
                $set: { "categories.$.minimumSalary": minSalary },
                $addToSet: {
                  "categories.$.companies": { $each: companyArray.map((name) => ({ name })) },
                },
              }
            );

            // If the category does not exist, push a new category
            await CompanyCategory.updateOne(
              { bank_id: bank._id, "categories.categoryName": { $ne: categoryName } },
              {
                $push: {
                  categories: {
                    categoryName,
                    minimumSalary: minSalary,
                    companies: companyArray.map((name) => ({ name })),
                  },
                },
              }
            );
          }

          // Delete CSV file after processing
          fs.unlinkSync(filePath);

          res.status(201).json({
            message: "Company categories uploaded and saved successfully!",
          });
        } catch (error) {
          console.error("Error processing CSV:", error);
          res.status(500).json({ message: "Error processing CSV file." });
        }
      });
  } catch (error) {
    console.error("Error uploading company categories:", error);
    res.status(500).json({ message: error.message });
  }
};


const checkCompanyCat  = async (req, res) => {
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


}
const autocompleteCompanies = async (req, res) => {
  try {
    console.log("🔍 API Hit: /api/autocompleteCompany");

    const userInput = req.query.userInput || ""; // Default to empty string for all companies
    console.log("📝 userInput:", userInput);

    const companies = await CompanyCategory.aggregate([
      { $unwind: "$categories" },
      { $unwind: "$categories.companies" },
      {
        $match: {
          "categories.companies.name": { 
            $regex: userInput, // Matches all if userInput is empty
            $options: "i" 
          }
        }
      },
      {
        $group: {
          _id: "$categories.companies.name",
          company: { $first: "$categories.companies.name" }
        }
      },
      { $sort: { company: 1 } }, // Sort alphabetically
      {
        $project: {
          _id: 0,
          company: 1
        }
      }
    ]);

    console.log("✅ Companies Fetched:", companies.length);

    res.json({ companies });
  } catch (error) {
    console.error("❌ Error fetching autocomplete:", error);
    res.status(500).json({ error: "Failed to fetch autocomplete results" });
  }
};




const CreateIndex = async (req, res)=>{
  try {
    await  CompanyCategory.collection.createIndex(
      { "categories.companies.name": 1 },
      { collation: { locale: "en", strength: 2 } }
    );
    res.json({ message: "Index created successfully!" });
  } catch (error) {
    console.error("Error creating index:", error);
    res.status(500).json({ error: "Index creation failed" });
  }

}
module.exports = {
  CreateIndex,
  autocompleteCompanies,
  uploadCompanyCategories,
    checkCompanyCat,
    autocompleteCompanies,
};