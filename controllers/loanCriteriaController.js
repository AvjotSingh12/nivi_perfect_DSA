const fs = require('fs');
const csv = require('csv-parser');
const Bank = require('../models/bankModel');
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
                minMonthlyIncome,
                bachelorAccommodationRequired,
                minExperienceMonths,
                pfDeduction,
              } = record;

              // Validate required fields
              if (
                !bankName ||
                !minAge ||
                !maxAge ||
                !minMonthlyIncome ||
                bachelorAccommodationRequired === undefined ||
                !minExperienceMonths ||
                pfDeduction === undefined
              ) {
                throw new Error("Missing required fields in record.");
              }

              // Convert and validate numeric fields
              const minAgeNum = parseInt(minAge, 10);
              const maxAgeNum = parseInt(maxAge, 10);
              const minMonthlyIncomeNum = parseInt(minMonthlyIncome, 10);
              const minExperienceMonthsNum = parseInt(minExperienceMonths, 10);

              if (
                isNaN(minAgeNum) ||
                isNaN(maxAgeNum) ||
                isNaN(minMonthlyIncomeNum) ||
                isNaN(minExperienceMonthsNum)
              ) {
                throw new Error("Invalid numeric values in record.");
              }

              // Check age range
              if (minAgeNum < 18 || maxAgeNum > 70 || minAgeNum > maxAgeNum) {
                throw new Error("Invalid age range.");
              }

              // Convert bachelorAccommodationRequired to boolean
              let bachelorRequired;
              try {
                bachelorRequired = JSON.parse(bachelorAccommodationRequired.toLowerCase());
                if (typeof bachelorRequired !== "boolean") {
                  throw new Error(`Invalid value for bachelorAccommodationRequired. Expected boolean, but got '${bachelorAccommodationRequired}'.`);
                }
              } catch (err) {
                throw new Error(`Invalid value for bachelorAccommodationRequired. Expected 'true' or 'false', but got '${bachelorAccommodationRequired}'.`);
              }

              // Convert pfDeduction to boolean
              let pfDeductionValue;
              try {
                pfDeductionValue = JSON.parse(pfDeduction.toLowerCase());
                if (typeof pfDeductionValue !== "boolean") {
                  throw new Error(`Invalid value for pfDeduction. Expected boolean, but got '${pfDeduction}'.`);
                }
              } catch (err) {
                throw new Error(`Invalid value for pfDeduction. Expected 'true' or 'false', but got '${pfDeduction}'.`);
              }

              // Search for the bank by bankName
              let bank = await Bank.findOne({ bankName });

              if (!bank) {
                // If the bank doesn't exist, create a new bank
                console.log(`Bank not found: ${bankName}. Creating new bank.`);
                bank = new Bank({ bankName }); // Create new bank
                await bank.save();
              }

              // Check for duplicates in PersonalLoan collection
              const existingRecord = await PersonalLoan.findOne({
                bank_id: bank._id,
                minAge: minAgeNum,
                maxAge: maxAgeNum,
                minMonthlyIncome: minMonthlyIncomeNum,
                bachelorAccommodationRequired: bachelorRequired,
                minExperienceMonths: minExperienceMonthsNum,
                pfDeduction: pfDeductionValue,
              });

              if (existingRecord) {
                console.log(`Duplicate record found: ${JSON.stringify(record)}`);
                errors.push({
                  record,
                  error: "Duplicate record found in database.",
                });
                continue; // Skip to the next record
              }

              // Prepare the record for insertion
              validRecords.push({
                bank_id: bank._id,
                bankName: bankName,
                minAge: minAgeNum,
                maxAge: maxAgeNum,
                minMonthlyIncome: minMonthlyIncomeNum,
                bachelorAccommodationRequired: bachelorRequired,
                minExperienceMonths: minExperienceMonthsNum,
                pfDeduction: pfDeductionValue,
              });
            } catch (err) {
              errors.push({ record, error: err.message });
            }
          }

          // Insert valid records into the database
          if (validRecords.length > 0) {
            await PersonalLoan.insertMany(validRecords);
          }

          // Delete the uploaded file after processing
          fs.unlinkSync(filePath);

          // Send response
          res.status(201).json({
            message: "Personal loan criteria uploaded successfully.",
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

