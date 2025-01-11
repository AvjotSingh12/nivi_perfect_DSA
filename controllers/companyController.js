const admin = require('firebase-admin');
const {db} = require('../config/firebaseConfig');

// companyCategoryController.js
const CompanyCategory = require('../models/companyCategoryModel');
const Bank = require('../models/bankModel');
const fs = require('fs');
const csv = require('csv-parser');

const uploadCompanyCategories = async (req, res) => {
  try {
    const filePath = req.file.path;
    const companyCategoriesData = [];

    fs.createReadStream(filePath)
      .pipe(csv({ headers: ['bank_name', 'categoryName', 'minimum_salary', 'companies'] })) // Explicitly set headers
      .on("data", (row) => {
        companyCategoriesData.push(row);
      })
      .on("end", async () => {
        for (const entry of companyCategoriesData) {
          const { bank_name, categoryName, minimum_salary, companies } = entry;

          // Debug: Log CSV data to verify
          console.log("Processing row:", entry);

          if (!bank_name || !categoryName || !minimum_salary || !companies) {
            console.error("Missing required data:", entry);
            continue; // Skip rows with missing data
          }

          // Check if the bank exists
          let bank = await Bank.findOne({ bankName: bank_name });  // Use bankName if that's the field in your schema
          
          // If the bank doesn't exist, create it
          if (!bank) {
            console.log(`Bank not found: ${bank_name}. Creating new bank.`);
            bank = new Bank({ bankName: bank_name }); // Use bankName if that's the field in your schema
            await bank.save();
          }

          // Ensure minimum_salary is a valid number
          const salary = Number(minimum_salary);
          if (isNaN(salary)) {
            console.error(`Invalid minimum_salary for category ${categoryName} at ${bank_name}`);
            continue; // Skip invalid salary rows
          }

          const companyArray = companies
            ? companies.split(",").map((company) => company.trim())
            : [];

          // Find or create the company category for the bank
          let companyCategory = await CompanyCategory.findOne({ bank_id: bank._id });

          if (!companyCategory) {
            companyCategory = new CompanyCategory({
              bank_id: bank._id,
              categories: [],
            });
          }

          // Check if the category already exists for the bank
          let existingCategory = companyCategory.categories.find(
            (category) => category.categoryName === categoryName
          );

          if (existingCategory) {
            // Update the existing category with the new companies and minimum salary
            existingCategory.companies = [
              ...new Set([
                ...existingCategory.companies.map((c) => c.name),
                ...companyArray,
              ]),
            ].map((name) => ({ name }));
            existingCategory.minimumSalary = Math.min(
              existingCategory.minimumSalary,
              salary
            );
          } else {
            // Add a new category if it doesn't exist
            companyCategory.categories.push({
              categoryName: categoryName,
              minimumSalary: salary,
              companies: companyArray.map((company) => ({ name: company })),
            });
          }

          // Save the company category
          await companyCategory.save();
        }

        // Clean up the uploaded file
        fs.unlinkSync(filePath);

        res.status(201).json({ message: "Company categories uploaded and saved successfully!" });
      });
  } catch (error) {
    console.error("Error uploading company categories:", error);
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
  uploadCompanyCategories
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

const autoCompleteCompany = async (req, res)=>{
    const userInput = req.query.query; // Get the user input (company name prefix) from query parameters

    if (!userInput) {
        return res.status(400).json({ error: 'Company name prefix is required' });
    }

    try {
        const companiesSnapshot = await db.collection('Test').get(); // Assuming the companies are stored in the 'Test' collection
        let matchingCompanies = [];

        companiesSnapshot.forEach(doc => {
            const companyList = doc.data().CompanyList; // Get the 'CompanyList' field

            if (companyList) {
                // Remove quotes and split by commas
                const companies = companyList
                    .replace(/"/g, '')        // Remove all double quotes
                    .split(',')               // Split by commas
                    .map(company => company.trim()); // Trim whitespace around each company name

                // Filter the companies that start with the user input
                companies.forEach(companyName => {
                    if (companyName.toLowerCase().startsWith(userInput.toLowerCase())) {
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

}



module.exports = {
    checkCompanyCat,
    autoCompleteCompany,
    uploadCompanyCategories
};