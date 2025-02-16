const mongoose = require("mongoose");

const BankSchema = new mongoose.Schema({
  bankNames: {type: String, required: true},
  logoUrl : {type: String, required: true},
  products : {type: String, required: true}
});

module.exports = mongoose.model("Bank", BankSchema);
