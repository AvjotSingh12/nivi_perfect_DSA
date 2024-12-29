// config/db.js
const mongoose = require("mongoose");// Import the config.js file

const connectMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI,{
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("Connected to MongoDB successfully!");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error.message);
        process.exit(1); // Exit on failure
    }
};

module.exports = connectMongoDB;