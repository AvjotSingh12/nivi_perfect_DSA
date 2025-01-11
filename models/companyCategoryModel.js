const mongoose = require('mongoose');

const companyCategorySchema = new mongoose.Schema({
  bank_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank', // Assuming 'Bank' is the model name
    required: true,
  },
  categories: [
    {
      categoryName: {
        type: String,
        required: true,
      },
      minimumSalary: {
        type: Number,
        required: true,
      },
      companies: [
        {
          name: {
            type: String,
            required: true,
          },
        },
      ],
    },
  ],
});

const CompanyCategory = mongoose.model('CompanyCategory', companyCategorySchema);
module.exports = CompanyCategory;
