const express = require('express');
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");


const { port, environment } = require("./config/config");
const {db} = require('./config/firebaseConfig');

const pincodeRoutes = require("./routes/pincodeRoutes");
const companyRoutes = require("./routes/companyRoutes");
const userRoutes = require("./routes/userRoutes");
const seedRoutes = require("./routes/seedRoutes");
const loanCriteriaRoutes = require('./routes/loanCriteriaRoutes');


const Bank = require("./models/bankModel");
const LoanCriteria = require("./models/loanCriteriaModel");

const upload = multer({ dest: "uploads/" }); 
require('dotenv').config();

const connectMongoDB = require("./config/db");

const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
app.use(cors({ origin: 'https://app.flutterflow.io' }));

app.use(bodyParser.json());
connectMongoDB();


app.use("/api", pincodeRoutes);
app.use("/api", companyRoutes);
app.use("/api", userRoutes);
app.use('/api/loanCriteria', loanCriteriaRoutes);
app.use('/api', seedRoutes);

app.get("/", (req, res) => {
    res.json({ message: "Welcome to nivifinivest backend " });
  });

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});