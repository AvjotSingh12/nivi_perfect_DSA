// config/config.js
require("dotenv").config(); // Load environment variables from .env file

module.exports = {
    mongoURI: process.env.MONGO_URI, // MongoDB connection string from .env
    port: process.env.PORT || 5000,  // Default port 5000 if not provided in .en // Secret key for JWT authentication
    environment: process.env.NODE_ENV || 'development', // Environment mode (e.g., development, production)
};
