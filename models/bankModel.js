const mongoose = require("mongoose");

const BankSchema = new mongoose.Schema({
  bankNames: {type: String, required: true},
  logoUrl : {type: String, required: false},
  products : {type: String, required: false}
});

module.exports = mongoose.model("Bank", BankSchema);
