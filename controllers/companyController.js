const admin = require('firebase-admin');
const {db} = require('../config/firebaseConfig');

// companyCategoryController.js
const Bank = require('../models/bankModel');
const fs = require("fs");
const csv = require("csv-parser");
const CompanyCategory = require("../models/companyCategoryModel"); // Update with your actual model path

// const uploadCompanyCategories = async (req, res) => {
//   try {
//     const filePath = req.file.path; // Path of uploaded CSV file
//     const companyCategoriesData = [];

//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on("data", (row) => {
//         companyCategoriesData.push(row);
//       })
//       .on("end", async () => {
//         try {
//           const bulkOps = [];
//           const bankNamesSet = new Set();
//           const categoryData = {};

//           // Collect all bank names to fetch them in one query
//           for (const entry of companyCategoriesData) {
//             if (entry["BANK NAME"] && entry["CAT"] && entry["COMPANY NAME"] && entry["MIN SALARY"]) {
//               bankNamesSet.add(entry["BANK NAME"].trim());
//             }
//           }

//           // Fetch all banks at once
//           const banks = await Bank.find({ bankName: { $in: Array.from(bankNamesSet) } });
//           const bankMap = new Map(banks.map(bank => [bank.bankName.toLowerCase(), bank._id]));

//           for (const entry of companyCategoriesData) {
//             const bankName = entry["BANK NAME"].trim();
//             const categoryName = entry["CAT"].trim();
//             const minSalary = entry["MIN SALARY"].trim();
//             const companies = entry["COMPANY NAME"].trim();

//             if (!bankName || !categoryName || !companies || !minSalary) {
//               console.error("Skipping row due to missing data:", entry);
//               continue;
//             }

//             let bankId = bankMap.get(bankName.toLowerCase());

//             if (!bankId) {
//               // Create new bank if it doesn't exist
//               const newBank = await Bank.create({ bankName });
//               bankId = newBank._id;
//               bankMap.set(bankName.toLowerCase(), bankId);
//             }

//             const companyArray = companies.split(",").map((c) => c.trim());

//             // Prepare key for unique categories per bank
//             const key = `${bankId}_${categoryName}`;

//             if (!categoryData[key]) {
//               categoryData[key] = {
//                 bank_id: bankId,
//                 bankName,
//                 categoryName,
//                 minSalary,
//                 companies: new Set(),
//               };
//             }

//             companyArray.forEach((company) => categoryData[key].companies.add(company));
//           }

//           for (const key in categoryData) {
//             const { bank_id, bankName, categoryName, minSalary, companies } = categoryData[key];

//             // Update categories array, ensure category exists first
//             bulkOps.push({
//               updateOne: {
//                 filter: { bank_id, "categories.categoryName": categoryName },
//                 update: {
//                   $set: {
//                     "categories.$.minimumSalary": minSalary,
//                   },
//                   $addToSet: {
//                     "categories.$.companies": { $each: Array.from(companies).map(name => ({ name })) },
//                   },
//                 },
//               },
//             });

//             // If category doesn't exist, add it
//             bulkOps.push({
//               updateOne: {
//                 filter: { bank_id },
//                 update: {
//                   $addToSet: {
//                     categories: {
//                       categoryName,
//                       minimumSalary: minSalary,
//                       companies: Array.from(companies).map(name => ({ name })),
//                     },
//                   },
//                 },
//                 upsert: true,
//               },
//             });
//           }

//           if (bulkOps.length > 0) {
//             await CompanyCategory.bulkWrite(bulkOps);
//           }

//           fs.unlinkSync(filePath);

//           res.status(201).json({
//             message: "Company categories uploaded and saved successfully!",
//           });
//         } catch (error) {
//           console.error("Error processing CSV:", error);
//           res.status(500).json({ message: "Error processing CSV file." });
//         }
//       });
//   } catch (error) {
//     console.error("Error uploading company categories:", error);
//     res.status(500).json({ message: error.message });
//   }
// };
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



// const uploadCompanyCategories = async (req, res) => {
//   try {
//     const filePath = req.file.path; // Path of uploaded CSV file
//     const companyCategoriesData = [];

//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on("data", (row) => {
//         companyCategoriesData.push(row);
//       })
//       .on("end", async () => {
//         try {
//           for (const entry of companyCategoriesData) {
//             const bankName = entry["BANK NAME"];
//             const categoryName = entry["CAT"];
//             const minSalary = entry["MIN SALARY"]
//             const companies = entry["COMPANY NAME"];

//             if (!bankName || !categoryName || !companies || !minSalary ) {
//               console.error("Skipping row due to missing data:", entry);
//               continue;
//             }

//             // Check if the bank already exists
//             const bank = await Bank.findOne({
//               bankNames: new RegExp(`^${bankName.trim()}$`, "i")
//             });

//             if (!bank) {
//               console.log(`Bank does not exist, skipping: ${bankName}`);
//               continue; // Skip if bank does not exist
//             }

//             // Convert companies string to array
//             const companyArray = companies.split(",").map((company) => company.trim());

//             // Check if CompanyCategory exists for the bank
//             let companyCategory = await CompanyCategory.findOne({ bank_id: bank._id });

//             if (!companyCategory) {
//               // Create a new CompanyCategory entry if it doesn't exist
//               companyCategory = new CompanyCategory({
//                 bank_id: bank._id,
//                 categories: [],
//               });
//             }

//             // Check if the category already exists
//             let existingCategory = companyCategory.categories.find(
//               (category) => category.categoryName === categoryName
//             );

//             if (existingCategory) {
//               // Merge companies into existing category
//               existingCategory.companies = [
//                 ...new Set([...existingCategory.companies.map((c) => c.name), ...companyArray]),
//               ].map((name) => ({ name }));
//             } else {
//               // Add a new category with companies
//               companyCategory.categories.push({
//                 categoryName: categoryName,
//                 minimumSalary: minSalary,
//                 companies: companyArray.map((company) => ({ name: company })),
//               });
//             }

//             // Save the updated company category
//             await companyCategory.save();
//           }

//           // Delete CSV file after processing
//           fs.unlinkSync(filePath);

//           res.status(201).json({
//             message: "Company categories uploaded and saved successfully!",
//           });
//         } catch (error) {
//           console.error("Error processing CSV:", error);
//           res.status(500).json({ message: "Error processing CSV file." });
//         }
//       });
//   } catch (error) {
//     console.error("Error uploading company categories:", error);
//     res.status(500).json({ message: error.message });
//   }
// };

module.exports = { uploadCompanyCategories };






  
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

// const autoCompleteCompany = async (req, res)=>{
//     const userInput = req.query.query; // Get the user input (company name prefix) from query parameters

//     if (!userInput) {
//         return res.status(400).json({ error: 'Company name prefix is required' });
//     }

//     try {
//         const companiesSnapshot = await db.collection('Test').get(); // Assuming the companies are stored in the 'Test' collection
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

// }

const autoCompleteCompany = async (req, res) => {
    const userInput = req.query.query; // Get user input (company name prefix)

    if (!userInput) {
        return res.status(400).json({ error: 'Company name prefix is required' });
    }

    try {
        // Query MongoDB to find matching full company names
        const matchingCompanies = await CompanyCategory.aggregate([
            { $unwind: "$categories" }, // Expand categories array
            { $unwind: "$categories.companies" }, // Expand companies array
            {
                $match: {
                    "categories.companies.name": { 
                        $regex: `^${userInput}`, // Match prefix case-insensitively
                        $options: "i"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    company: {
                        $trim: { input: "$categories.companies.name", chars: "\"" } // Remove unwanted quotes
                    }
                }
            }
        ]);

        // Ensure full company names are returned
        const formattedCompanies = matchingCompanies.map(item => ({
            company: item.company.trim() // Trim any extra spaces
        }));

        // Respond with matching companies
        if (formattedCompanies.length > 0) {
            return res.json({ message: 'Companies found', companies: formattedCompanies });
        } else {
            return res.json({ message: 'No companies found for this prefix. Add a new company for this prefix.' });
        }
    } catch (error) {
        console.error('Error fetching data from MongoDB:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { autoCompleteCompany };


module.exports = {
    checkCompanyCat,
    autoCompleteCompany,
    uploadCompanyCategories
};