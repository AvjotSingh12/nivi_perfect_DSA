const mongoose = require('mongoose');

const BusinessLoanCriteriaSchema = new mongoose.Schema({
  
  bank_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bank", // Ensure "Bank" matches your Bank collection name
    required: true
  },
  bankNames: {
    type: String,
    required: true, // Mandatory field for the bank name
  },
  minAge: {
    type: Number,
    required: true,
    min: 18,
    max: 70, // Ensuring applicant's age is within a valid range
  },
  maxAge: {
    type: Number,
    required: true,
  },
  requiredBusinessVintage: {
    type: Number, // Number of years in business (string to match "3 years")
    required: true,
  },
  minAverageBankBalance: {
    type: Number,
    required: true,
  },
  allowedBusinessOperationForms: {
    type: [String], // Array of allowed business operation forms
    required: true,
  },
  OperativeBankAccount: {
    type: [String], // Fixed incorrect type
    required: true,
  },
  requiresITR: {
    type: Boolean,
    required: true,
  },
  minITRYears: {
    type: Number,
    required: function () {
      return this.requiresITR; // Only required if ITR is needed
    },
  },
  requiresAuditedITR: {
    type: Boolean,
    required: function () {
      return this.requiresITR; // Only required if ITR is needed
    },
  },
  requiresGSTCertificate: {
    type: Boolean,
    required: true,
  },
  requiresGSTReturnsFiling: {
    type: Boolean,
    required: true,
  },
  turnover: {
    type: Number,
    required: true,
  },
  Ownership: {
    type: [String], // Array since CSV contains multiple values (Own, Rented)
    required: true,
  },
  Coapplicant: {
    type: Boolean, // TRUE/FALSE, so Boolean is better
    required: true,
  },
  CoapplicantMinAge: {
    type: Number,
    required: true,
    min: 18,
  },
  CoapplicantMaxAge: {
    type: Number,
    required: true,
  },
  CibilisNegative: {
    type: Boolean,
    required: true,
  },
  additionalCriteria: {
    type: String, // Any additional information
    required: false,
  },
});

module.exports = mongoose.model('BusinessLoanCriteria', BusinessLoanCriteriaSchema);
