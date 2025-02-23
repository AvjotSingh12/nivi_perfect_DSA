const mongoose = require("mongoose");

const PersonalLoanSchema = new mongoose.Schema({
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: "Bank", required: true },
  bankName: { type: String, required: true },
  minAge: { type: Number, required: true },
  maxAge: { type: Number, required: true },
  minMonthlyIncome: {
    type: Number,
    required: function () {
      return this.isNew && (!this.categorywiseincome || this.categorywiseincome.length === 0);
    },
  },
  categorywiseincome: {
    type: Array,
    default: [],
  },
  bachelorAccommodationRequired: { type: Boolean, required: true },
  minExperienceMonths: { type: Number, required: true },
  pfDeduction: { type: Boolean, required: true },
});

const PersonalLoan = mongoose.model("PersonalLoan", PersonalLoanSchema);
module.exports = PersonalLoan;
