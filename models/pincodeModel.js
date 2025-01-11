// pincodeModel.js

const mongoose = require('mongoose');

const pincodeSchema = new mongoose.Schema({
  bank_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: true
  },
  serviceable_pincodes: [{
    type: String,
    required: true
  }]
});

const Pincode = mongoose.model('Pincode', pincodeSchema);

module.exports = Pincode;
