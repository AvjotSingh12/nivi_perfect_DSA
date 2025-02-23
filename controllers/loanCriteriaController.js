const fs = require('fs');
const csv = require('csv-parser');
const Bank = require('../models/bankModel');

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

              // **Get bank_id from Map (or create new)**



              // **Determine minMonthlyIncome:**




              // **Check for existing record**
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

          //  await PersonalLoan.insertMany(validRecords);

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



//  exports.uploadPersonalLoanCriteria = async (req, res) => {
//    const filePath = req.file?.path;

//    if (!filePath) {
//      return res.status(400).json({ error: "No file uploaded." });
//    }

//    try {
//      const records = [];

//      fs.createReadStream(filePath)
//        .pipe(csv())
//        .on("data", (row) => {
//          records.push(row);
//        })
//        .on("end", async () => {
//          try {
//            if (records.length === 0) {
//              throw new Error("CSV file is empty.");
//            }

//            const errors = [];
//            const validRecords = [];

//            // **Preload all banks into a Map**
//            const banks = await Bank.find({}, { _id: 1, bankName: 1 });
//            const bankMap = new Map(banks.map((bank) => [bank.bankName, bank._id]));

//            // **Preload CompanyCategory data (category-wise income)**
//            const companyCategories = await CompanyCategory.find({}, { bankName: 1, categories: 1 });
//            const salaryMap = new Map();

//            companyCategories.forEach((categoryData) => {
//              const categorySalaryMap = new Map(
//                categoryData.categories.map((cat) => [cat.categoryName, cat.minimumSalary])
//              );
//              salaryMap.set(categoryData.bankName, categorySalaryMap);
//            });

//            for (const record of records) {
//              try {
//                let {
//                  bankName,
//                  minAge,
//                  maxAge,
//                  minMonthlyIncome,
//                  category,
//                  bachelorAccommodationRequired,
//                  minExperienceMonths,
//                  pfDeduction,
//                } = record;

//                // **Validation**
//                if (
//                  !bankName ||
//                  !minAge ||
//                  !maxAge ||
//                  !minExperienceMonths ||
//                  bachelorAccommodationRequired === undefined ||
//                  pfDeduction === undefined
//                ) {
//                  throw new Error("Missing required fields in record.");
//                }

//                const minAgeNum = parseInt(minAge, 10);
//                const maxAgeNum = parseInt(maxAge, 10);

//                if (isNaN(minAgeNum) || isNaN(maxAgeNum) || isNaN(minExperienceMonthsNum)) {
//                  throw new Error("Invalid numeric values in record.");
//                }

//                if (minAgeNum < 18 || maxAgeNum > 70 || minAgeNum > maxAgeNum) {
//                  throw new Error("Invalid age range.");
//                }

//                // Convert boolean fields
//                const bachelorRequired = bachelorAccommodationRequired.toLowerCase() === "yes";
//                const pfDeductionValue = pfDeduction.toLowerCase() === "yes";

//                // **Get bank_id from Map (or create new)**
//                let bank_id = bankMap.get(bankName);
//                if (!bank_id) {
//                  const newBank = new Bank({ bankName });
//                  await newBank.save();
//                  bank_id = newBank._id;
//                  bankMap.set(bankName, bank_id);
//                }

//                let categoriesToProcess = [];

//                // **If category is empty, fetch from CompanyCategory**
//                if (!category || category.trim() === "") {
//                  const categoryData = salaryMap.get(bankName);
//                  if (categoryData) {
//                    categoriesToProcess = [...categoryData.keys()];
//                  } else {
//                    throw new Error(`No categories found for bank: ${bankName}`);
//                  }
//                } else {
//                  categoriesToProcess = [category];
//                }

//                // **Process multiple categories if needed**
//                for (const cat of categoriesToProcess) {
//                  let minMonthlyIncomeNum = parseInt(minMonthlyIncome, 10);

//                  // **Use category-wise salary if minMonthlyIncome is missing**
//                  if (isNaN(minMonthlyIncomeNum) || minMonthlyIncome.trim() === "") {
//                    const categorySalary = salaryMap.get(bankName)?.get(cat);
//                    minMonthlyIncomeNum = categorySalary !== undefined ? categorySalary : 0;
//                  }

//                  // **Check for existing record**
//                  const existingRecord = await PersonalLoan.findOne({
//                    bank_id,
//                    minAge: minAgeNum,
//                    maxAge: maxAgeNum,
//                    minMonthlyIncome: minMonthlyIncomeNum,
//                    category: cat,
//                    bachelorAccommodationRequired: bachelorRequired,
//                    minExperienceMonths: minExperienceMonthsNum,
//                    pfDeduction: pfDeductionValue,
//                  });

//                  if (existingRecord) {
//                    errors.push({ record, category: cat, error: "Duplicate record found in database." });
//                    continue;
//                  }

//                  // **Add to bulk insert**
//                  validRecords.push({
//                    bank_id,
//                    bankName,
//                    minAge: minAgeNum,
//                    maxAge: maxAgeNum,
//                    minMonthlyIncome: minMonthlyIncomeNum,
//                    category: cat,
//                    bachelorAccommodationRequired: bachelorRequired,
//                    minExperienceMonths: minExperienceMonthsNum,
//                    pfDeduction: pfDeductionValue,
//                  });
//                }
//              } catch (err) {
//                errors.push({ record, error: err.message });
//              }
//            }

//            // **Bulk Insert**
//            if (validRecords.length > 0) {
//              await PersonalLoan.insertMany(validRecords);
//            }

//            // **Delete CSV file**
//            fs.unlinkSync(filePath);

//            // **Response**
//            res.status(201).json({
//              message: "Personal loan criteria uploaded successfully.",
//              recordsUploaded: validRecords.length,
//              errors,
//            });
//          } catch (err) {
//            console.error("Error saving records:", err);
//            res.status(500).json({ error: "Error saving records." });
//          }
//        })
//        .on("error", (err) => {
//          console.error("Error reading CSV file:", err);
//          res.status(500).json({ error: "Error reading CSV file." });
//        });
//    } catch (err) {
//      console.error("Error processing CSV file:", err);
//      res.status(500).json({ error: "Error processing CSV file." });
//    }
//  };


// exports.uploadPersonalLoanCriteria = async (req, res) => {
//   const filePath = req.file?.path;

//   if (!filePath) {
//     return res.status(400).json({ error: "No file uploaded." });
//   }

//   try {
//     const records = [];

//     // Parse CSV file
//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on("data", (row) => {
//         records.push(row);
//       })
//       .on("end", async () => {
//         try {
//           if (records.length === 0) {
//             throw new Error("CSV file is empty.");
//           }

//           const errors = [];
//           const validRecords = [];

//           // **Step 1: Preload all banks into a Map**
//           const banks = await Bank.find({}, { _id: 1, bankName: 1 });
//           const bankMap = new Map(banks.map((bank) => [bank.bankName, bank._id]));

//           const companyCategories = await CompanyCategory.find({}, { bankName: 1, categories: 1 });

//           const catgegoryMap = new Map();

//           companyCategories.forEach((category) => {
//             salaryMap.set(category.bankName, categories);
//           });
//           for (const record of records) {
//             try {
//               const {
//                 bankName,
//                 minAge,
//                 maxAge,
//                 minMonthlyIncome,
//                 category,
//                 bachelorAccommodationRequired,
//                 minExperienceMonths,
//                 pfDeduction,
//               } = record;

//               // **Validation**
//               if (!bankName || !minAge || !maxAge || bachelorAccommodationRequired === undefined || !minExperienceMonths || pfDeduction === undefined) {
//                 throw new Error("Missing required fields in record.");
//               }

//               const minAgeNum = parseInt(minAge, 10);
//               const maxAgeNum = parseInt(maxAge, 10);
//               const minExperienceMonthsNum = minExperienceMonths;

//               if (isNaN(minAgeNum) || isNaN(maxAgeNum) || isNaN(minExperienceMonthsNum)) {
//                 throw new Error("Invalid numeric values in record.");
//               }

//               if (minAgeNum < 18 || maxAgeNum > 70 || minAgeNum > maxAgeNum) {
//                 throw new Error("Invalid age range.");
//               }

//               // Convert boolean fields
//               const bachelorRequired = bachelorAccommodationRequired.toLowerCase() == "yes";
//               const pfDeductionValue = pfDeduction.toLowerCase() == "yes";

//               console.log(bachelorRequired);
//               console.log(pfDeductionValue);

//               // **Get bank_id from Map (or create new)**
//               let bank_id = bankMap.get(bankName);
//               if (!bank_id) {
//                 const newBank = new Bank({ bankName });
//                 await newBank.save();
//                 bank_id = newBank._id;
//                 bankMap.set(bankName, bank_id);
//               }

//               // **Determine minMonthlyIncome:**
//               let minMonthlyIncomeNum;

//               if(minMonthlyIncomeNum == ""){

//               }else{
//                 minMonthlyIncomeNum =parseInt(minMonthlyIncome, 10);

//               }

//               if (isNaN(minMonthlyIncomeNum)) {
//                 // If income is blank, get from salaryMap
//                 minMonthlyIncomeNum = salaryMap.get(bankName) || 0;
//               }

//               // **Check for existing record**
//               const existingRecord = await PersonalLoan.findOne({
//                 bank_id,
//                 minAge: minAgeNum,
//                 maxAge: maxAgeNum,
//                 minMonthlyIncome: minMonthlyIncomeNum,
//                 category,
//                 bachelorAccommodationRequired: bachelorRequired,
//                 minExperienceMonths: minExperienceMonthsNum,
//                 pfDeduction: pfDeductionValue,
//               });

//               if (existingRecord) {
//                 errors.push({
//                   record,
//                   error: "Duplicate record found in database.",
//                 });
//                 continue;
//               }

//               // **Add to bulk insert**
//               validRecords.push({
//                 bank_id,
//                 bankName,
//                 minAge: minAgeNum,
//                 maxAge: maxAgeNum,
//                 minMonthlyIncome: minMonthlyIncomeNum,
//                 category,
//                 bachelorAccommodationRequired: bachelorRequired,
//                 minExperienceMonths: minExperienceMonthsNum,
//                 pfDeduction: pfDeductionValue,
//               });
//             } catch (err) {
//               errors.push({ record, error: err.message });
//             }
//           }

//           // **Step 4: Bulk Insert**
//           if (validRecords.length > 0) {
//             await PersonalLoan.insertMany(validRecords);
//           }

//           // **Delete CSV file**
//           fs.unlinkSync(filePath);

//           // **Response**
//           res.status(201).json({
//             message: "Personal loan criteria uploaded successfully.",
//             recordsUploaded: validRecords.length,
//             errors,
//           });
//         } catch (err) {
//           console.error("Error saving records:", err);
//           res.status(500).json({ error: "Error saving records." });
//         }
//       })
//       .on("error", (err) => {
//         console.error("Error reading CSV file:", err);
//         res.status(500).json({ error: "Error reading CSV file." });
//       });
//   } catch (err) {
//     console.error("Error processing CSV file:", err);
//     res.status(500).json({ error: "Error processing CSV file." });
//   }
//  };

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

