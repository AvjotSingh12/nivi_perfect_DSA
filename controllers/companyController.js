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


const checkCompanyCat = async (req, res) => {
  try {
    const { companyName } = req.query;

    if (!companyName) {
      return res.status(400).json({ message: "Company name is required!" });
    }

    // Fetch only 2 relevant bank records for debugging
    const results = await CompanyCategory.find(
      { "categories.companies.name": companyName.trim() },
      {
        _id: 0,
        bank_id: 1,
        categories: 1,
      }
    ); // Limit query to 2 entries

    if (results.length === 0) {
      return res.status(404).json({ message: "No records found for this company." });
    }

    // Fetch bank names using `Promise.all` to handle async operations
    const response = await Promise.all(
      results.map(async (result) => {
        const bank = await Bank.findById(result.bank_id, { _id: 0, bankNames: 1 });

        const category = result.categories.find(
          (cat) =>
            Array.isArray(cat.companies) &&
            cat.companies.some(
              (c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase()
            )
        );

        return {
          bank: bank ? bank.bankNames : "Unknown Bank",
          category: category ? category.categoryName : "Unknown Category",
        };
      })
    );

  
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching bank names and categories:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



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
      { $sort: { company: 1 } }, 
      { $limit: 100 }, // Sort alphabetically
      {
        $project: {
          _id: 0,
          company: 1
        }
      }
    ]).allowDiskUse(true);;

    console.log("✅ Companies Fetched:", companies.length);

    res.json({ companies });
  } catch (error) {
    console.error("❌ Error fetching autocomplete:", error);
    res.status(500).json({ error: "Failed to fetch autocomplete results" });
  }
};


const createIndex = async (req, res) => {
  try {
    await CompanyCategory.collection.createIndex({
      bankName: 1,
      "categories.categoryName": 1,
      "categories.companies.name": 1
    });

    res.status(200).json({ message: "Index created successfully!" });
  } catch (error) {
    console.error("Error creating index:", error);
    res.status(500).json({ message: "Failed to create index", error });
  }
}



const cleanCompanyNames = async (req, res) => {
  try {
    await CompanyCategory.updateMany(
      {},
      [
        {
          $set: {
            categories: {
              $map: {
                input: "$categories",
                as: "category",
                in: {
                  categoryName: "$$category.categoryName",
                  minimumSalary: "$$category.minimumSalary",
                  companies: {
                    $map: {
                      input: "$$category.companies",
                      as: "company",
                      in: {
                        name: {
                          $trim: {
                            input: {
                              $replaceAll: { input: "$$company.name", find: "\"", replacement: "" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    );

    res.json({ message: "Company names cleaned successfully!" });
  } catch (error) {
    console.error("Error cleaning company names:", error);
    res.status(500).json({ error: "Cleaning failed" });
  }
};




module.exports = {
  cleanCompanyNames,
  createIndex,
  autocompleteCompanies,
  uploadCompanyCategories,
    checkCompanyCat,
    autocompleteCompanies,
};