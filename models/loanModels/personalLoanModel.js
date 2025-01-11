const mongoose = require("mongoose");

// Define the schema
const PersonalLoanSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: true, // Mandatory field for the bank name
  },
  minAge: {
    type: Number,
    min: 18, // Assuming a minimum age of 18
    max: 70, // Assuming a maximum age of 70
    required: true, // Mandatory field
  },
  maxAge: {
    type: Number,
    min: 18,
    max: 70,
    required: true, // Mandatory field
  },
  minMonthlyIncome: {
    type: Number,
    required: true, // Mandatory field for minimum monthly income
  },
  bachelorAccommodationRequired: {
    type: Boolean, // Restrict to true/false (Yes/No in boolean form)
    required: true,
  },
  minExperienceMonths: {
    type: Number,
    min: 0, // Minimum work experience cannot be negative
    required: true, // Mandatory field
  },
 
  pfDeduction: {
    type: Boolean, // Restrict to true/false
    required: true,
  },
});

// Create the model
const PersonalLoan = mongoose.model("PersonalLoanCriteria", PersonalLoanSchema);

module.exports = PersonalLoan;
