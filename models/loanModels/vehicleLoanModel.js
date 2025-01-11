const mongoose = require('mongoose');

const vehicleLoanCriteriaSchema = new mongoose.Schema({
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank' },
  criteria: {
    minExperienceMonths: { type: Number },
    ageRange: {
      min: { type: Number },
      max: { type: Number },
    },
    pfDeduction: { type: Boolean },
    bachelorRequired: { type: Boolean },
    pincode: { type: String },
  },
});

module.exports = mongoose.model('VehicleLoan', vehicleLoanCriteriaSchema);
