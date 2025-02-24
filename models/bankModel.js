const mongoose = require("mongoose");

const BankSchema = new mongoose.Schema({
  bankNames: { type: String, required: true },
  logoUrl: { type: String, required: false },
  products: { type: String, required: false },
  pan_india_service: { type: Boolean, default: true } // Default is now TRUE
});

module.exports = mongoose.model("Bank", BankSchema);
