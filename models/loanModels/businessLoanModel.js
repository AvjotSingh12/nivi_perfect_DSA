const mongoose = require('mongoose');

const BusinessSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: true, // Mandatory field for the bank name
  },
  minAge: {
    type: Number,
    required: true, // Minimum age of the applicant required by the bank
  },
  maxAge: {
    type: Number,
    required: true, // Maximum age of the applicant required by the bank
  },
  requiredBusinessVintage: {
    type: String, // Minimum business vintage (e.g., "3 years")
    required: true,
  },
  minAverageBankBalance: {
    type: Number, // Minimum average bank balance required by the bank
    required: true,
  },
  allowedEntityTypes: {
    type: [String], // Array of allowed entity types (e.g., ["Sole Proprietorship", "LLP", "Private Limited"])
    required: true,
  },
  allowedBusinessOperationForms: {
    type: [String], // Array of allowed operation forms (e.g., ["Shop", "Office", "Factory"])
    required: true,
  },
  requiresITR: {
    type: Boolean,
    required: true, // Whether ITR is mandatory
  },
  minITRYears: {
    type: Number, // Minimum number of ITR years required, if ITR is mandatory
    required: function () {
      return this.requiresITR;
    },
  },
  requiresAuditedITR: {
    type: Boolean, // Whether audited ITR is mandatory
    required: function () {
      return this.requiresITR;
    },
  },
  requiresGSTCertificate: {
    type: Boolean,
    required: true, // Whether GST Certificate is mandatory
  },
  requiresGSTReturnsFiling: {
    type: Boolean,
    required: true, // Whether GST return filing is mandatory
  },
  additionalCriteria: {
    type: String, // Any additional criteria the bank might specify
    required: false,
  },
});

module.exports = mongoose.model('BusinessLoanCriteria', BusinessSchema);
