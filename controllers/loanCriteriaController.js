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
const standardizeCompanyName = (name) => {
  if (!name || typeof name !== "string") return "";
  
  return name
      .replace(/["']/g, '')  // Remove double and single quotes
      .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
      .trim()                // Trim leading and trailing spaces
      .toUpperCase();        // Convert to uppercase
};


exports.getBanksByPincodeAndCategory = async (req, res) => {
  try {
    const { pincode, companyName, age, monthlyIncome, experienceMonths, bachelorAccommodation, pfDeduction } = req.query;

    if (!pincode || !companyName || !age || !monthlyIncome || !experienceMonths || pfDeduction === undefined || bachelorAccommodation === undefined) {
      return res.status(400).json({ message: "All query parameters are required" });
    }

    const experienceMapping = {
      "Less than 1 Month": 0,
      "1 month": 1,
      "2 month": 2,
      "3 months-6months": 3,
      "6 months-1Year": 6,
      "1+ Year": 12
    };
    console.log("Pincode:", pincode," ", typeof(pincode));
    console.log("Company Name:", " ",companyName, typeof(companyName));
    console.log("User Age:", age," ",typeof(age));
    console.log("User Monthly Income:", monthlyIncome," ", typeof(monthlyIncome));
    console.log("User Experience Months:", experienceMonths, " ",typeof(experienceMonths));
    console.log("User Bachelor Accommodation:", bachelorAccommodation," ", typeof(bachelorAccommodation));
    console.log("User PF Deduction:", pfDeduction," ", typeof(pfDeduction));
    
    
    const userAge = parseInt(age);
    const userMonthlyIncome = parseFloat(monthlyIncome);
    const userExperienceMonths = experienceMapping[experienceMonths] ?? parseInt(experienceMonths);    
    const userBachelorAccommodation = bachelorAccommodation.toLowerCase() === "yes";
    const userPfDeduction = pfDeduction.toLowerCase() === "yes";

    

    const panIndiaBanks = await Bank.find({ pan_india_service: true })
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
     
    console.log("bank ids" , matchingBankIds);
 
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
          console.log("found banks:", bankDetails.bankNames);
         

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

exports.updateBusinessVintage = async (req, res) => {
  try {
      // Step 1: Find all documents where `requiredBusinessVintage` is a string
      await LoanCriteria.updateMany(
          { requiredBusinessVintage: { $type: "string" } },
          [
              {
                  $set: {
                    requiredBusinessVintage: {
                          $toInt: { $arrayElemAt: [{ $split: ["$requiredBusinessVintage", " "] }, 0] }
                      }
                  }
              }
          ]
      );

      res.status(200).json({ message: "Business vintage updated successfully!" });
  } catch (error) {
      console.error("Error updating business vintage:", error);
      res.status(500).json({ message: "Failed to update business vintage", error: error.message });
  }
};

exports.uploadBusinessLoanCriteria = async (req, res) => {
  const filePath = req.file?.path;

  if (!filePath) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const records = [];

    fs.createReadStream(filePath)
      .pipe(csv())
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

          for (const record of records) {
            try {
              const {
                bankNames,
                minAge,
                maxAge,
                requiredBusinessVintage,
                minAverageBankBalance,
                allowedBusinessOperationForms,
                OperativeBankAccount,
                requiresITR,
                minITRYears,
                requiresAuditedITR,
                requiresGSTCertificate,
                requiresGSTReturnsFiling,
                turnover,
                Ownership,
                Coapplicant,
                CoapplicantMinAge,
                CoapplicantMaxAge,
                CibilisNegative,
              } = record;

              // Validate required fields
              const missingFields = [];
              if (!bankNames) missingFields.push("bankNames");
              if (!minAge) missingFields.push("minAge");
              if (!maxAge) missingFields.push("maxAge");
              if (!requiredBusinessVintage) missingFields.push("requiredBusinessVintage");
              if (!minAverageBankBalance) missingFields.push("minAverageBankBalance");
              if (!allowedBusinessOperationForms) missingFields.push("allowedBusinessOperationForms");
              if (!OperativeBankAccount) missingFields.push("OperativeBankAccount");
              if (!turnover) missingFields.push("turnover");
              if (!Ownership) missingFields.push("Ownership");
              if (!Coapplicant) missingFields.push("Coapplicant");
              if (!CoapplicantMinAge) missingFields.push("CoapplicantMinAge");
              if (!CoapplicantMaxAge) missingFields.push("CoapplicantMaxAge");
              if (!CibilisNegative) missingFields.push("CibilisNegative");

              if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
              }

              // Convert numeric fields
              const minAgeNum = parseInt(minAge, 10);
              const maxAgeNum = parseInt(maxAge, 10);
              const minAverageBankBalanceNum = parseFloat(minAverageBankBalance);
              const turnoverNum = parseFloat(turnover);
              const CoapplicantMinAgeNum = parseInt(CoapplicantMinAge, 10);
              const CoapplicantMaxAgeNum = parseInt(CoapplicantMaxAge, 10);
              const minITRYearsNum = requiresITR ? parseInt(minITRYears, 10) : null;
              const businessVintageNum = parseInt(requiredBusinessVintage, 10);

              if (
                isNaN(minAgeNum) || isNaN(maxAgeNum) || isNaN(minAverageBankBalanceNum) ||
                isNaN(turnoverNum) || isNaN(CoapplicantMinAgeNum) || isNaN(CoapplicantMaxAgeNum) || isNaN(businessVintageNum)
              ) {
                throw new Error("Invalid numeric values in record.");
              }

              if (minAgeNum < 18 || maxAgeNum > 70 || minAgeNum > maxAgeNum) {
                throw new Error("Invalid age range. minAge must be ≤ maxAge and within 18-70.");
              }

              // Convert boolean fields safely
              const requiresITRValue = requiresITR.toLowerCase() === "true";
              const requiresAuditedITRValue = requiresAuditedITR.toLowerCase() === "true";
              const requiresGSTCertificateValue = requiresGSTCertificate.toLowerCase() === "true";
              const requiresGSTReturnsFilingValue = requiresGSTReturnsFiling.toLowerCase() === "true";
              const CibilisNegativeValue = CibilisNegative.toLowerCase() === "true";
              const requiresCoApplicant = Coapplicant.toLowerCase() === "true";

              // Convert string fields to arrays
              const operativeBankAccounts = OperativeBankAccount.replace(/"/g, "").trim().split(/\s*,\s*/);
              const ownershipList = Ownership.replace(/"/g, "").trim().split(/\s*,\s*/);;
              const allowedBusinessFormsList = allowedBusinessOperationForms.replace(/"/g, "").trim().split(/\s*,\s*/);;

              // Check if the bank exists, or create a new one
              let bank = await Bank.findOne({ bankNames });

              if (!bank) {
                console.log(`Bank not found: ${bankNames}. Creating new bank.`);
                bank = new Bank({ bankNames });
                await bank.save();
              }

              // Prepare the record for insertion
              validRecords.push({
                bank_id: bank._id,
                bankNames,
                minAge: minAgeNum,
                maxAge: maxAgeNum,
                requiredBusinessVintage: businessVintageNum,
                minAverageBankBalance: minAverageBankBalanceNum,
                allowedBusinessOperationForms: allowedBusinessFormsList,
                OperativeBankAccount: operativeBankAccounts,
                requiresITR: requiresITRValue,
                minITRYears: minITRYearsNum,
                requiresAuditedITR: requiresAuditedITRValue,
                requiresGSTCertificate: requiresGSTCertificateValue,
                requiresGSTReturnsFiling: requiresGSTReturnsFilingValue,
                turnover: turnoverNum,
                Ownership: ownershipList,
                Coapplicant: requiresCoApplicant,
                CoapplicantMinAge: CoapplicantMinAgeNum,
                CoapplicantMaxAge: CoapplicantMaxAgeNum,
                CibilisNegative: CibilisNegativeValue,
              });

            } catch (err) {
              errors.push({ record, error: err.message });
            }
          }

          // Insert valid records
          if (validRecords.length > 0) {
            console.log(validRecords);
            await Business.insertMany(validRecords);
          }

          fs.unlinkSync(filePath); // Cleanup file

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

exports.checkBusinessLoanEligibility = async (req, res) => {
  try {
    const {
      age,
      businessVintage,
      businessOperationForm,
      averageBankBalance,
      operativeBankAccount,
      ITR,
      ITRYears,
      auditedITR,
      GSTCertificate,
      GSTReturnsFiling,
      turnover,
      ownership,
      coapplicant,
      coapplicantAge,
      cibilNegative,
    } = req.query;

    // Convert values to appropriate types
    const ageNum = age ? parseInt(age, 10) : NaN;
    const businessVintageNum = businessVintage ? parseInt(businessVintage, 10) : NaN;
    const averageBankBalanceNum = averageBankBalance ? parseFloat(averageBankBalance) : NaN;
    const turnoverNum = turnover ? parseFloat(turnover) : NaN;
    const coapplicantAgeNum = coapplicantAge ? parseInt(coapplicantAge, 10) : NaN;
    const ITRYearsNum = ITRYears ? parseInt(ITRYears, 10) : null;

    // Validate numeric fields
    if (
      isNaN(ageNum) || isNaN(businessVintageNum) ||
      isNaN(averageBankBalanceNum) || isNaN(turnoverNum) || 
      (coapplicant && isNaN(coapplicantAgeNum))
    ) {
      return res.status(400).json({ error: "Invalid numeric values in request." });
    }

    // Validate age constraints
    if (ageNum < 18 || ageNum > 70) return res.status(400).json({ error: "Age must be between 18 and 70." });
    if (coapplicant && (coapplicantAgeNum < 18 || coapplicantAgeNum > 70)) {
      return res.status(400).json({ error: "Co-applicant age must be between 18 and 70." });
    }

    // Convert boolean values safely
    const ITRValue = ITR?.toLowerCase() === "true";
    const auditedITRValue = auditedITR?.toLowerCase() === "true";
    const GSTCertificateValue = GSTCertificate?.toLowerCase() === "true";
    const GSTReturnsFilingValue = GSTReturnsFiling?.toLowerCase() === "true";
    const cibilNegativeValue = cibilNegative?.toLowerCase() === "true";
    const coapplicantValue = coapplicant?.toLowerCase() === "true";

    // Convert string inputs to arrays for querying
    const businessOperationForms = businessOperationForm
      ? businessOperationForm.split(",").map(s => s.trim())
      : [];

    const ownershipTypes = ownership
      ? ownership.split(",").map(s => s.trim())
      : [];

    const operativeBankAccounts = Array.isArray(operativeBankAccount)
      ? operativeBankAccount
      : operativeBankAccount ? [operativeBankAccount] : [];

    // Build MongoDB query object
    const eligibilityQuery = {
      minAge: { $lte: ageNum },
      maxAge: { $gte: ageNum },
       requiredBusinessVintage: { $lte: businessVintageNum },
       minAverageBankBalance: { $gte: averageBankBalanceNum },
      allowedBusinessOperationForms: { $in: businessOperationForms },
      OperativeBankAccount: { $in: operativeBankAccounts },
      requiresITR: ITRValue,
      minITRYears: ITRYearsNum ? { $lte: ITRYearsNum } : { $exists: false },
      requiresAuditedITR: ITRValue ? auditedITRValue : { $exists: false },
      requiresGSTCertificate: GSTCertificateValue,
      requiresGSTReturnsFiling: GSTReturnsFilingValue,
      turnover: { $gte: turnoverNum },
     Ownership: { $in: ownershipTypes },
      Coapplicant: coapplicantValue ? true : { $exists: false },
      CoapplicantMinAge: coapplicantValue ? { $lte: coapplicantAgeNum } : { $exists: false },
      CoapplicantMaxAge: coapplicantValue ? { $gte: coapplicantAgeNum } : { $exists: false },
      CibilisNegative: cibilNegativeValue ? true : { $exists: false },
    };

   

    // Fetch eligible banks
    const eligibleBanks = await Business.find(eligibilityQuery).populate("bank_id", "bankNames logoUrl");

    if (!eligibleBanks.length) {
      return res.status(404).json({ message: "No banks found matching the criteria." });
    }


    // Format response
    const banksList = eligibleBanks.map(record => ({
      bankName: record.bank_id?.bankNames || "Unknown",
      logoUrl: record.bank_id?.logoUrl || "",
     
    }));

    res.status(200).json({
      message: "Eligible banks found.",
      banks: banksList,
    });

  } catch (error) {
    console.error("Error checking business loan eligibility:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



