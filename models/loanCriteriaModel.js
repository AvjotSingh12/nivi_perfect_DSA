const mongoose = require("mongoose");


const LoanCriteriaSchema = new mongoose.Schema({
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: "Bank", required: true },
  loanType: { type: String },  // "Personal", "Home", etc.
  criteria: {
    minExperienceMonths: { type: Number },
    ageRange: {
      min: { type: Number },
      max: { type: Number },
    },
    pfDeduction: { type: String },
    bachelorRequired: { type: String },
    pincode: { type: String },
  },
});


module.exports = mongoose.model("LoanCriteria", LoanCriteriaSchema);
