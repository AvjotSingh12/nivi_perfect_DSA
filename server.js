const express = require('express');
const { port, environment } = require("./config/config");

const pincodeRoutes = require("./routes/pincodeRoutes");

const companyRoutes = require("./routes/companyRoutes");

const userRoutes = require("./routes/userRoutes");



require('dotenv').config();
const connectMongoDB = require("./config/db");
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(bodyParser.json());
connectMongoDB();

const {db} = require('./config/firebaseConfig');
app.use("/api", pincodeRoutes);
app.use("/api", companyRoutes);

app.use("/api", userRoutes);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});