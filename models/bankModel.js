const mongoose = require("mongoose");

const BankSchema = new mongoose.Schema({
  bankName: { type: String, required: true },
  address: { type: String },
  contact_info: { type: String },
});

module.exports = mongoose.model("Bank", BankSchema);
