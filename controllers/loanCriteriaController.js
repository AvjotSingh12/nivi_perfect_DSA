const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require("mongoose");

const Bank = require('../models/bankModel');

const PincodeService = require("../models/pincodeModel");
const CompanyCategory = require("../models/companyCategoryModel");
const LoanCriteria = require('../models/loanCriteriaModel');
const PersonalLoan = require('../models/loanModels/personalLoanModel');
const VehicleLoan = require('../models/loanModels/vehicleLoanModel');
const HomeLoan = require('../models/loanModels/personalLoanModel');

const Business = require('../models/loanModels/businessLoanModel');


exports.uploadVehicleLoanCriteria = async (req, res) => {
  const filePath = req.file.path;

  try {
    const records = [];

    // Parse the CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', async () => {
        for (const record of records) {
          const { bankName, minExperienceMonths, ageMin, ageMax, pfDeduction, bachelorRequired, pincode } = record;

          // Find or create the bank
          let bank = await Bank.findOne({ name: bankName });
          if (!bank) {
            bank = await Bank.create({ name: bankName, address: 'Unknown', contact_info: 'Unknown' });
          }

          // Create vehicle loan criteria
          await VehicleLoan.create({
            bank_id: bank._id,
            criteria: {
              minExperienceMonths: parseInt(minExperienceMonths, 10),
              ageRange: { min: parseInt(ageMin, 10), max: parseInt(ageMax, 10) },
              pfDeduction: pfDeduction === 'true',
              bachelorRequired: bachelorRequired === 'true',
              pincode,
            },
          });
        }

        fs.unlinkSync(filePath);

        res.status(201).send('Vehicle loan criteria uploaded successfully.');
      });
  } catch (err) {
    console.error('Error processing CSV file:', err);
    res.status(500).send('Error processing CSV file.');
  }
};

exports.uploadPersonalLoanCriteria = async (req, res) => {
  const filePath = req.file?.path;

  if (!filePath) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const records = [];

    // Parse CSV file
    fs.createReadStream(filePath)
      .pipe(csv({
        headers: ["bankNames", "minAge", "maxAge", "minMonthlyIncome", "bachelorAccommodationRequired", "minExperienceMonths", "pfDeduction"],
        skipLines: 1, // Skip header row if needed
      }))
      .on("data", (row) => {


        records.push(row);
      })
      .on("end", async () => {
        try {
          if (records.length === 0) {
            throw new Error("CSV file is empty.");
          }

          const errors = [];
          const validRecords = [];

          // **Step 1: Preload all banks into a Map**
          // **Step 1: Preload all banks into a Map using bank_id**
          const banks = await Bank.find({}, { _id: 1, bankNames: 1 });

          const bankMap = new Map();
          banks.forEach((bank) => {
            if (bank._id) {
              bankMap.set(bank.bankNames, bank._id.toString()); // Store `bank_id` as key, bankNames as value
            }
          });

          // **Step 2: Load Company Categories with bank_id**
          const companyCategories = await CompanyCategory.find({}, {
            bank_id: 1,
            "categories.categoryName": 1,
            "categories.minimumSalary": 1
          });

          // **Step 3: Create a Category Map using bank_id**
          const categoryMap = new Map();

          // **Loop through companyCategories and map them correctly**
          companyCategories.forEach((categoryData) => {
            const { bank_id, categories } = categoryData;

            if (!bank_id || !categories) return;

            // Extract categories for this bank_id
            const bankCategories = categories.map(({ categoryName, minimumSalary }) => ({
              categoryName,
              minimumSalary,
            }));

            // Store in map (avoid overwriting by appending existing values)
            if (categoryMap.has(bank_id.toString())) {
              categoryMap.get(bank_id.toString()).push(...bankCategories);
            } else {
              categoryMap.set(bank_id.toString(), bankCategories);
            }
          });


          for (const record of records) {
            try {
              const {
                bankNames,
                minAge,
                maxAge,
                minMonthlyIncome,
                category,
                bachelorAccommodationRequired,
                minExperienceMonths,
                pfDeduction,
              } = record;


              console.log(record);


              // **Validation**
              //  if (
              //   !bankNames?.trim() || 
              //   !minAge?.trim() || 
              //   !maxAge?.trim() || 
              //   !minExperienceMonths?.trim() || 
              //   bachelorAccommodationRequired === "" || 
              //   pfDeduction === ""
              // ) {
              //   throw new Error("Missing required fields in record.");
              // }
              let categorywiseincome = [];


              let bank_id = bankMap.get(record.bankNames);
              console.log(bank_id);
              let monthlyIncome = record.minMonthlyIncome

              if (!monthlyIncome || monthlyIncome === "") {
                console.log("⚠️ minMonthlyIncome is empty for bank_id:", bank_id);

                const categories = categoryMap.get(bank_id.toString());
                console.log("📂 Categories found:", categories);

                if (categories && categories.length > 0) {
                  categorywiseincome = categories;
                  monthlyIncome = null;

                  console.log("✅ Assigned categorywiseincome:", categorywiseincome);
                } else {
                  categorywiseincome = []; // No categories available
                }
              }
              console.log("this is my array ", categorywiseincome);
              const minAgeNum = parseInt(minAge, 10);
              const maxAgeNum = parseInt(maxAge, 10);
              const minExperienceMonthsNum = parseInt(minExperienceMonths, 10);
              let minMonthlyIncomeNum = minMonthlyIncome ? parseInt(minMonthlyIncome, 10) : null;

              // **If minMonthlyIncome is missing, use category array**
              let finalCategory = [];
              if (!minMonthlyIncomeNum) {
                finalCategory = categoryMap.get(bankNames) || [];
                minMonthlyIncomeNum = null; // Ensure it's null if no value provided
              } else {
                finalCategory = category ? [category] : []; // Keep category if given
              }

              console.log("final categories", finalCategory);



              if (isNaN(minAgeNum) || isNaN(maxAgeNum) || isNaN(minExperienceMonthsNum)) {
                throw new Error("Invalid numeric values in record.");
              }

              if (minAgeNum < 18 || maxAgeNum > 70 || minAgeNum > maxAgeNum) {
                throw new Error("Invalid age range.");
              }

              // **Convert boolean fields safely**
              const bachelorRequired = (record.bachelorAccommodationRequired || "").toLowerCase() === "yes";
              const pfDeductionValue = (record.pfDeduction || "").toLowerCase() === "yes";


              const existingRecord = await PersonalLoan.findOne({
                bank_id,
                minAge: minAgeNum,
                maxAge: maxAgeNum,
                minMonthlyIncome: minMonthlyIncomeNum,
                category: finalCategory,
                bachelorAccommodationRequired: bachelorRequired,
                minExperienceMonths: minExperienceMonthsNum,
                pfDeduction: pfDeductionValue,
              });

              if (existingRecord) {
                errors.push({
                  record,
                  error: "Duplicate record found in database.",
                });
                continue;
              }
              // **Add to bulk insert**


              // **Add categorywiseincome if available**
              // Build record object dynamically
              const recordObject = {
                bank_id: bank_id,
                bankName: bankNames,
                minAge: minAgeNum,
                maxAge: maxAgeNum,
                bachelorAccommodationRequired: bachelorRequired,
                minExperienceMonths: minExperienceMonthsNum,
                pfDeduction: pfDeductionValue,
                categorywiseincome: categorywiseincome,
              };

              // Ensure `minMonthlyIncome` is set only when required
              if (!categorywiseincome || categorywiseincome.length === 0) {
                recordObject.minMonthlyIncome = parseInt(monthlyIncome, 10) || 0; // Default to 0 if undefined
              } else {
                recordObject.minMonthlyIncome = undefined; // Ensures it's not added
              }

              validRecords.push(recordObject);



            } catch (err) {
              errors.push({ record, error: err.message });
            }
          }


          // **Step 4: Bulk Insert**
          if (validRecords.length > 0) {

            await PersonalLoan.insertMany(validRecords);

          }

          // **Delete CSV file**
          fs.unlinkSync(filePath);

          // **Response**
          return res.status(201).json({
            message: "Personal loan criteria uploaded successfully.",
            recordsUploaded: validRecords.length,
            errors,
          });
        } catch (err) {
          console.error("❌ Error saving records:", err);
          res.status(500).json({ error: "Error saving records." });
        }
      })
      .on("error", (err) => {
        console.error("❌ Error reading CSV file:", err);
        res.status(500).json({ error: "Error reading CSV file." });
      });
  } catch (err) {
    console.error("❌ Error processing CSV file:", err);
    res.status(500).json({ error: "Error processing CSV file." });
  }
};
// exports.getBanksByPincode = async (req, res) => {
//   try {
//     const { pincode } = req.query;

//     if (!pincode) {
//       return res.status(400).json({ message: "Pincode is required" });
//     }

//     // ✅ Fetch banks that provide Pan-India service
//     const panIndiaBanks = await Bank.find({ pan_india_service: true })
//       .select("_id bankNames logoUrl")
//       .lean();
//     console.log("Pan-India Banks:", panIndiaBanks); // Debugging

//     // ✅ Fetch banks that specifically serve this pincode
//     const pincodeBanks = await PincodeService.find({ serviceable_pincodes: pincode })
//       .populate("bank_id", "_id bankNames logoUrl")
//       .lean();
//     console.log("Pincode Service Banks:", pincodeBanks); // Debugging

//     // ✅ Extract bank details from pincode services
//     const specificBanks = pincodeBanks.map(service => service.bank_id);

//     // ✅ Merge results and remove duplicates
//     const allBanks = [...new Map([...panIndiaBanks, ...specificBanks].map(bank => [bank._id.toString(), bank])).values()];

//     return res.status(200).json({ banks: allBanks });

//   } catch (error) {
//     console.error("Error fetching banks:", error);
//     return res.status(500).json({ message: "Internal Server Error", error: error.message });
//   }
// };


      
// exports.getBanksByPincodeAndCategory = async (req, res) => {
//   try {
//     const { pincode, companyName, age, monthlyIncome, experienceMonths, bachelorAccommodation, pfDeduction } = req.query;

//     if (!pincode || !companyName || !age || !monthlyIncome || !experienceMonths || pfDeduction === undefined || bachelorAccommodation === undefined) {
//       return res.status(400).json({ message: "All query parameters are required" });
//     }

//     // Convert string values to proper data types
//     const userAge = parseInt(age);
//     const userMonthlyIncome = parseFloat(monthlyIncome);
//     const userExperienceMonths = parseInt(experienceMonths);
//     const userBachelorAccommodation = bachelorAccommodation.toLowerCase() === "yes"; ;
//     const userPfDeduction = pfDeduction.toLowerCase() === "yes";;

//     // ✅ Find the bank that serves the given company
//     const companyCategoryDoc = await CompanyCategory.findOne({
//       "categories.companies.name": companyName
//     })
//       .select("bank_id")
//       .lean();

      

//     if (!companyCategoryDoc) {
//       return res.status(404).json({ message: "Company category not found" });
//     }

//     const bankId = companyCategoryDoc.bank_id;

   

//     // ✅ Fetch banks that provide Pan-India service and match the bank ID
//     const panIndiaBanks = await Bank.find({ _id: bankId,  pan_india_service: true })
//       .select("bankNames logoUrl")
//       .lean();

     
//     // ✅ Fetch banks that specifically serve this pincode and match bank ID
//     const pincodeBanks = await PincodeService.find({ serviceable_pincodes: pincode, bank_id: bankId })
//       .populate("bank_id", "bankNames logoUrl")
//       .lean();

//     // ✅ Extract valid bank details from pincode services
//     const specificBanks = pincodeBanks.map(service => service.bank_id).filter(bank => bank);

//     // ✅ Merge results and remove duplicates
//     const allBanks = [...new Map([...panIndiaBanks, ...specificBanks].map(bank => [bank._id.toString(), bank])).values()];

//     const personalLoanCriteria = await PersonalLoan.findOne({ bank_id: bankId }).lean();

//     if (!personalLoanCriteria) {
//       return res.status(404).json({ message: "Loan criteria not found for the bank" });
//     }

//     const isEligible =
//       userAge >= personalLoanCriteria.minAge &&
//       userAge <= personalLoanCriteria.maxAge &&
//       userExperienceMonths >= personalLoanCriteria.minExperienceMonths &&
//       userPfDeduction === personalLoanCriteria.pfDeduction &&
//       userBachelorAccommodation === personalLoanCriteria.bachelorAccommodationRequired &&
//       (personalLoanCriteria.categorywiseincome.length > 0
//         ? personalLoanCriteria.categorywiseincome.some(
//             (category) => userMonthlyIncome >= category.minimumIncome
//           )
//         : userMonthlyIncome >= personalLoanCriteria.minMonthlyIncome);

//     return res.status(200).json({
//       banks: allBanks,
//       eligibility: isEligible,
//       message: isEligible ? "You are eligible for a loan from this bank" : "You are not eligible for a loan from this bank"
//     });

//   } catch (error) {
//     console.error("Error fetching banks:", error);
//     return res.status(500).json({ message: "Internal Server Error", error: error.message });
//   }
// };

// exports.getBanksByPincodeAndCategory = async (req, res) => {
//   try {
//     const { pincode, companyName, age, monthlyIncome, experienceMonths, bachelorAccommodation, pfDeduction } = req.query;

//     if (!pincode || !companyName || !age || !monthlyIncome || !experienceMonths || pfDeduction === undefined || bachelorAccommodation === undefined) {
//       return res.status(400).json({ message: "All query parameters are required" });
//     }

//     // Convert string values to proper data types
//     const userAge = parseInt(age);
//     const userMonthlyIncome = parseFloat(monthlyIncome);
//     const userExperienceMonths = parseInt(experienceMonths);
//     const userBachelorAccommodation = bachelorAccommodation.toLowerCase() === "yes";
//     const userPfDeduction = pfDeduction.toLowerCase() === "yes";
  
//     // ✅ Find the bank that serves the given company
//     const standardizedCompanyName = companyName.toLowerCase().trim();

//     // ✅ Find the bank that serves the given company
//     const companyCategoryDoc = await CompanyCategory.findOne({
//       "categories.companies.name": { $regex: new RegExp(`^${standardizedCompanyName}$`, "i") }
//     })
//       .select("bank_id categories.companies.name")
//       .lean();
      
//       const companyCategories = await CompanyCategory.find().select("categories").lean();
// companyCategories.forEach((categoryDoc, index) => {
//   console.log(`Document ${index + 1}:`);
//   categoryDoc.categories.forEach((category, catIndex) => {
//     console.log(`  Category ${catIndex + 1}:`, category.companies?.map(c => c.name));
//   });
// });

//     if (!companyCategoryDoc) {
//       return res.status(404).json({ message: "Company category not found" });
//     }

//     const bankId = companyCategoryDoc.bank_id;

//     // ✅ Fetch banks that provide Pan-India service and match the bank ID
//     const panIndiaBanks = await Bank.find({ _id: bankId, pan_india_service: true })
//       .select("bankNames logoUrl")
//       .lean();

//     // ✅ Fetch banks that specifically serve this pincode and match bank ID
//     const pincodeBanks = await PincodeService.find({ serviceable_pincodes: pincode, bank_id: bankId })
//       .populate("bank_id", "bankNames logoUrl")
//       .lean();

//     // ✅ Extract valid bank details from pincode services
//     const specificBanks = pincodeBanks.map(service => service.bank_id).filter(bank => bank);

//     // ✅ Merge results and remove duplicates
//     const allBanks = [...new Map([...panIndiaBanks, ...specificBanks].map(bank => [bank._id.toString(), bank])).values()];

//     // ✅ Check eligibility criteria
//     const personalLoanCriteria = await PersonalLoan.findOne({ bank_id: bankId }).lean();

//     if (!personalLoanCriteria) {
//       return res.status(404).json({ message: "Loan criteria not found for the bank" });
//     }

//     const isEligible =
//       userAge >= personalLoanCriteria.minAge &&
//       userAge <= personalLoanCriteria.maxAge &&
//       userExperienceMonths >= personalLoanCriteria.minExperienceMonths &&
//       userPfDeduction === personalLoanCriteria.pfDeduction &&
//       userBachelorAccommodation === personalLoanCriteria.bachelorAccommodationRequired &&
//       (personalLoanCriteria.categorywiseincome.length > 0
//         ? personalLoanCriteria.categorywiseincome.some(
//             (category) => userMonthlyIncome >= category.minimumIncome
//           )
//         : userMonthlyIncome >= personalLoanCriteria.minMonthlyIncome);

//     // ✅ Return only bank names and URLs if eligible
//     if (isEligible) {
//       return res.status(200).json({ banks: allBanks.map(({ bankNames, logoUrl }) => ({ bankNames, logoUrl })) });
//     } else {
//       return res.status(200).json({ banks: [], message: "You are not eligible for a loan from this bank" });
//     }

//   } catch (error) {
//     console.error("Error fetching banks:", error);
//     return res.status(500).json({ message: "Internal Server Error", error: error.message });
//   }
// };

const standardizeCompanyName = (name) => {
  if (!name || typeof name !== "string") return "";
  
  return name
      .replace(/["']/g, '')  // Remove double and single quotes
      .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
      .trim()                // Trim leading and trailing spaces
      .toUpperCase();        // Convert to uppercase
};
const getBanksByPincode = async (pincode) => {
  try {
    if (!pincode) {
      return { message: "Pincode is required" };
    }

    // ✅ Fetch banks that provide Pan-India service
    const panIndiaBanks = await Bank.find({ pan_india_service: true })
      .select("_id bankNames logoUrl")
      .lean();

    // ✅ Fetch banks that specifically serve this pincode
    const pincodeBanks = await PincodeService.find({ serviceable_pincodes: pincode })
      .populate("bank_id", "_id bankNames logoUrl")
      .lean();

    // ✅ Extract bank details from pincode services
    const specificBanks = pincodeBanks.map(service => service.bank_id);

    // ✅ Merge results and remove duplicates
    const allBanks = [...new Map([...panIndiaBanks, ...specificBanks].map(bank => [bank._id.toString(), bank])).values()];

    return { banks: allBanks };

  } catch (error) {
    console.error("Error fetching banks:", error);
    return { message: "Internal Server Error", error: error.message };
  }
};

const getCompanyCategory = async (name) => {
  try {
    // ✅ Standardize company name
    const standardizedCompanyName = standardizeCompanyName(name.trim().replace(/^"|"$/g, ""));

    // ✅ Fetch company categories
    const companyCategories = await CompanyCategory.find().select("bank_id categories").lean();

    let bankResults = [];

    for (const categoryDoc of companyCategories) {
      for (const category of categoryDoc.categories) {
        const foundCompany = category.companies.find(
          (company) => standardizeCompanyName(company.name) === standardizedCompanyName
        );

        if (foundCompany) {
          bankResults.push({
            bank_id: categoryDoc.bank_id,
            category: category.categoryName,
          });
        }
      }
    }

    if (bankResults.length === 0) {
      return { message: "Company category not found in any bank" };
    }

    // ✅ Fetch bank names based on bank IDs
    const bankIds = bankResults.map((entry) => entry.bank_id);
    const banks = await Bank.find({ _id: { $in: bankIds } }).select("bankNames").lean();

    // ✅ Map bank names with categories
    return bankResults.map((entry) => {
      const bank = banks.find((b) => b._id.toString() === entry.bank_id.toString());
      return {
        bankName: bank ? bank.bankNames : "Unknown Bank",
        category: entry.category,
      };
    });
  } catch (error) {
    console.error("Error fetching company category:", error);
    return { message: "Internal Server Error", error: error.message };
  }
};


exports.getBanksByPincodeAndCategory = async (req, res) => {
  try {
    const { pincode, companyName, age, monthlyIncome, experienceMonths, bachelorAccommodation, pfDeduction } = req.query;

    if (!pincode || !companyName || !age || !monthlyIncome || !experienceMonths || pfDeduction === undefined || bachelorAccommodation === undefined) {
      return res.status(400).json({ message: "All query parameters are required" });
    }
    // Convert string values to proper data types
    const userAge = parseInt(age);
    const userMonthlyIncome = parseFloat(monthlyIncome);
    const userExperienceMonths = parseInt(experienceMonths);
    const userBachelorAccommodation = bachelorAccommodation.toLowerCase() === "yes";
    const userPfDeduction = pfDeduction.toLowerCase() === "yes";
     
    const panIndiaBanks = await Bank.find({ pan_india_service: true }) // Ensure filtering only pan-India banks
    .select("bankNames logoUrl")
    .lean();
  

    // ✅ Fetch banks that specifically serve this pincode and match bank ID
    const pincodeBanks = await PincodeService.find({
      serviceable_pincodes: { $in: [pincode] } // Ensures it checks within an array
    })
    .populate("bank_id", "bankNames logoUrl")
    .lean();
    

    // ✅ Extract valid bank details from pincode services
    const specificBanks = pincodeBanks
    .map(service => service.bank_id)
    .filter(bank => bank !== null && bank !== undefined);
  

    // ✅ Merge results and remove duplicates
    const allBanks = [
      ...new Map(
        [...panIndiaBanks, ...specificBanks].map(bank => [bank?._id?.toString(), bank])
      ).values()
    ];
    

    // ✅ Standardize company name from user input
    const standardizedCompanyName = standardizeCompanyName(companyName);
   

    // ✅ Fetch all company categories and standardize names
    const companyCategories = await CompanyCategory.find({
      bank_id: { $in: allBanks.map(bank => bank._id) } // Filter only those banks present in allBanks
    }).select("bank_id categories").lean();
    
    const matchingBankIds = new Set(); // Store multiple IDs

    for (const categoryDoc of companyCategories) {
      if (!categoryDoc.categories) continue;
    
      for (const category of categoryDoc.categories) {
        if (!category.companies || !Array.isArray(category.companies)) continue;
    
        for (const company of category.companies) {
          if (standardizeCompanyName(company.name) === standardizedCompanyName) {
            matchingBankIds.add(categoryDoc.bank_id.toString());
          }
        }
      }
    }
    
    if (matchingBankIds.size === 0) {
      return res.status(404).json({ message: "Company category not found" });
    }

 
    const eligibleBanks = [];

    // Check loan criteria for each bank in the set
    for (const bankId of matchingBankIds) {
      const personalLoanCriteria = await PersonalLoan.findOne({ bank_id: bankId }).lean();

      if (!personalLoanCriteria) continue; // Skip if no criteria found

      // Check eligibility
      const isEligible =
        userAge >= personalLoanCriteria.minAge &&
        userAge <= personalLoanCriteria.maxAge &&
        userExperienceMonths >= personalLoanCriteria.minExperienceMonths &&
        userPfDeduction === personalLoanCriteria.pfDeduction &&
        userBachelorAccommodation === personalLoanCriteria.bachelorAccommodationRequired &&
        (personalLoanCriteria.categorywiseincome.length > 0
          ? personalLoanCriteria.categorywiseincome.some(category => userMonthlyIncome >= category.minimumIncome)
          : userMonthlyIncome >= personalLoanCriteria.minMonthlyIncome);

      if (isEligible) {
        // Find the bank details
        const bankDetails = allBanks.find(bank => bank._id.toString() === bankId);
        if (bankDetails) {
          eligibleBanks.push({ bankNames: bankDetails.bankNames, logoUrl: bankDetails.logoUrl });
        }
      }
    }

    return res.status(200).json({ banks: eligibleBanks });

  } catch (error) {
    console.error("Error fetching banks:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// exports.getBanksByPincodeAndCategory = async (req, res) => {
//   try {
//     const { pincode, companyName, age, monthlyIncome, experienceMonths, bachelorAccommodation, pfDeduction } = req.query;

//     if (!pincode || !companyName || !age || !monthlyIncome || !experienceMonths || pfDeduction === undefined || bachelorAccommodation === undefined) {
//       return res.status(400).json({ message: "All query parameters are required" });
//     }

//     // Convert string values to proper data types
//     const userAge = parseInt(age);
//     const userMonthlyIncome = parseFloat(monthlyIncome);
//     const userExperienceMonths = parseInt(experienceMonths);
//     const userBachelorAccommodation = bachelorAccommodation.toLowerCase() === "yes";
//     const userPfDeduction = pfDeduction.toLowerCase() === "yes";

//     // ✅ Standardize company name from user input
//     const standardizedCompanyName = standardizeCompanyName(companyName);
//     console.log(standardizedCompanyName);

//     // ✅ Fetch all company categories and standardize names
//     const companyCategories = await CompanyCategory.find().select("bank_id categories").lean();

//     let matchingBankId = null;

//     for (const categoryDoc of companyCategories) {
//       for (const category of categoryDoc.categories) {
//         const foundCompany = category.companies.find(company => standardizeCompanyName(company.name) === standardizedCompanyName);
//         console.log(foundCompany);
//         if (foundCompany) {
//           matchingBankId = categoryDoc.bank_id;
//           break;
//         }
//       }
//       if (matchingBankId) break;
//     }

//     if (!matchingBankId) {
//       return res.status(404).json({ message: "Company category not found" });
//     }

//     // ✅ Fetch banks that provide Pan-India service and match the bank ID
//     const panIndiaBanks = await Bank.find({ _id: matchingBankId, pan_india_service: true })
//       .select("bankNames logoUrl")
//       .lean();

//     // ✅ Fetch banks that specifically serve this pincode and match bank ID
//     const pincodeBanks = await PincodeService.find({ serviceable_pincodes: pincode, bank_id: matchingBankId })
//       .populate("bank_id", "bankNames logoUrl")
//       .lean();

//     // ✅ Extract valid bank details from pincode services
//     const specificBanks = pincodeBanks.map(service => service.bank_id).filter(bank => bank);

//     // ✅ Merge results and remove duplicates
//     const allBanks = [...new Map([...panIndiaBanks, ...specificBanks].map(bank => [bank._id.toString(), bank])).values()];

//     // ✅ Check eligibility criteria
//     const personalLoanCriteria = await PersonalLoan.findOne({ bank_id: matchingBankId }).lean();

//     if (!personalLoanCriteria) {
//       return res.status(404).json({ message: "Loan criteria not found for the bank" });
//     }

//     const isEligible =
//       userAge >= personalLoanCriteria.minAge &&
//       userAge <= personalLoanCriteria.maxAge &&
//       userExperienceMonths >= personalLoanCriteria.minExperienceMonths &&
//       userPfDeduction === personalLoanCriteria.pfDeduction &&
//       userBachelorAccommodation === personalLoanCriteria.bachelorAccommodationRequired &&
//       (personalLoanCriteria.categorywiseincome.length > 0
//         ? personalLoanCriteria.categorywiseincome.some(
//             (category) => userMonthlyIncome >= category.minimumIncome
//           )
//         : userMonthlyIncome >= personalLoanCriteria.minMonthlyIncome);

//     // ✅ Return only bank names and URLs if eligible
//     if (isEligible) {
//       return res.status(200).json({ banks: allBanks.map(({ bankNames, logoUrl }) => ({ bankNames, logoUrl })) });
//     } else {
//       return res.status(200).json({ banks: [], message: "You are not eligible for a loan from this bank" });
//     }

//   } catch (error) {
//     console.error("Error fetching banks:", error);
//     return res.status(500).json({ message: "Internal Server Error", error: error.message });
//   }
// };


exports.uploadHomeLoanCriteria = async (req, res) => {
  const filePath = req.file.path;

  try {
    const records = [];

    // Parse the CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', async () => {
        for (const record of records) {
          const { bankName, minExperienceMonths, ageMin, ageMax, pfDeduction, bachelorRequired, pincode } = record;

          // Find or create the bank
          let bank = await Bank.findOne({ name: bankName });
          if (!bank) {
            bank = await Bank.create({ name: bankName, address: 'Unknown', contact_info: 'Unknown' });
          }

          // Create home loan criteria
          await HomeLoan.create({
            bank_id: bank._id,
            criteria: {
              minExperienceMonths: parseInt(minExperienceMonths, 10),
              ageRange: { min: parseInt(ageMin, 10), max: parseInt(ageMax, 10) },
              pfDeduction: pfDeduction === 'true',
              bachelorRequired: bachelorRequired === 'true',
              pincode,
            },
          });
        }

        fs.unlinkSync(filePath);

        res.status(201).send('Home loan criteria uploaded successfully.');
      });
  } catch (err) {
    console.error('Error processing CSV file:', err);
    res.status(500).send('Error processing CSV file.');
  }
};

exports.uploadBusinessLoanCriteria = async (req, res) => {
  const filePath = req.file?.path;

  if (!filePath) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const records = [];

    // Parse the CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        records.push(row); // Collect records
      })
      .on("end", async () => {
        try {
          if (records.length === 0) {
            throw new Error("CSV file is empty.");
          }

          const errors = [];
          const validRecords = [];

          for (const record of records) {
            try {
              const {
                bankName,
                minAge,
                maxAge,
                requiredBusinessVintage,
                minAverageBankBalance,
                allowedEntityTypes,
                allowedBusinessOperationForms,
                requiresITR,
                minITRYears,
                requiresAuditedITR,
                requiresGSTCertificate,
                requiresGSTReturnsFiling,
                additionalCriteria,
              } = record;

              // Validate required fields
              if (
                !bankName ||
                !minAge ||
                !maxAge ||
                !requiredBusinessVintage ||
                !minAverageBankBalance ||
                !allowedEntityTypes ||
                !allowedBusinessOperationForms ||
                requiresITR === undefined ||
                requiresGSTCertificate === undefined ||
                requiresGSTReturnsFiling === undefined
              ) {
                throw new Error("Missing required fields in record.");
              }

              // Convert and validate numeric fields
              const minAgeNum = parseInt(minAge, 10);
              const maxAgeNum = parseInt(maxAge, 10);
              const minAverageBankBalanceNum = parseFloat(minAverageBankBalance);
              const minITRYearsNum = requiresITR
                ? parseInt(minITRYears, 10)
                : null;

              if (
                isNaN(minAgeNum) ||
                isNaN(maxAgeNum) ||
                isNaN(minAverageBankBalanceNum)
              ) {
                throw new Error("Invalid numeric values in record.");
              }

              // Validate minAge and maxAge range
              if (minAgeNum < 18 || maxAgeNum > 70 || minAgeNum > maxAgeNum) {
                throw new Error(
                  "Age criteria are invalid. Ensure minAge <= maxAge and within 18-70."
                );
              }

              // Convert boolean fields
              const requiresITRValue = JSON.parse(requiresITR.toLowerCase());
              const requiresAuditedITRValue = requiresITR
                ? JSON.parse(requiresAuditedITR.toLowerCase())
                : null;
              const requiresGSTCertificateValue = JSON.parse(
                requiresGSTCertificate.toLowerCase()
              );
              const requiresGSTReturnsFilingValue = JSON.parse(
                requiresGSTReturnsFiling.toLowerCase()
              );

              // Ensure boolean values are valid
              if (
                typeof requiresITRValue !== "boolean" ||
                (requiresITR &&
                  typeof requiresAuditedITRValue !== "boolean") ||
                typeof requiresGSTCertificateValue !== "boolean" ||
                typeof requiresGSTReturnsFilingValue !== "boolean"
              ) {
                throw new Error("Invalid boolean values in record.");
              }

              // Check if the bank exists, or create a new one
              let bank = await Bank.findOne({ bankName });

              if (!bank) {
                console.log(`Bank not found: ${bankName}. Creating new bank.`);
                bank = new Bank({ bankName });
                await bank.save();
              }

              // Prepare the record for insertion
              validRecords.push({
                bank_id: bank._id, // Link to the Bank entity
                bankName,
                minAge: minAgeNum,
                maxAge: maxAgeNum,
                requiredBusinessVintage,
                minAverageBankBalance: minAverageBankBalanceNum,
                allowedEntityTypes: allowedEntityTypes.split(","),
                allowedBusinessOperationForms:
                  allowedBusinessOperationForms.split(","),
                requiresITR: requiresITRValue,
                minITRYears: minITRYearsNum,
                requiresAuditedITR: requiresAuditedITRValue,
                requiresGSTCertificate: requiresGSTCertificateValue,
                requiresGSTReturnsFiling: requiresGSTReturnsFilingValue,
                additionalCriteria,
              });
            } catch (err) {
              errors.push({ record, error: err.message });
            }
          }

          // Insert valid records into the database
          if (validRecords.length > 0) {
            await Business.insertMany(validRecords);
          }

          // Delete the uploaded file after processing
          fs.unlinkSync(filePath);

          // Send response
          res.status(201).json({
            message: "Business loan criteria uploaded successfully.",
            recordsUploaded: validRecords.length,
            errors,
          });
        } catch (err) {
          console.error("Error saving records:", err);
          res.status(500).json({ error: "Error saving records." });
        }
      })
      .on("error", (err) => {
        console.error("Error reading CSV file:", err);
        res.status(500).json({ error: "Error reading CSV file." });
      });
  } catch (err) {
    console.error("Error processing CSV file:", err);
    res.status(500).json({ error: "Error processing CSV file." });
  }
};

