const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Bank = require('../models/bankModel');

exports.addBanks = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "CSV file is required!" });
    }

    const filePath = path.resolve(req.file.path);
    console.log('Uploaded file path:', filePath);

    // Ensure file exists
    if (!fs.existsSync(filePath)) {
        return res.status(400).json({ message: "Uploaded file does not exist!" });
    }

    let banks = [];

    try {
        const stream = fs.createReadStream(filePath)
            .pipe(csv()) .on("headers", (headers) => {
                console.log("CSV Headers:", headers); // Debug headers
            });
            stream.on("headers", (headers) => {
                console.log("Headers after trimming:", headers.map(h => h.trim()));
            });
        stream.on('data', (row) => {
            if (!row.bankNames) {
                console.error("⚠️ Missing bankNames field in row:", row);
            }
        
            console.log("Row Data:", row); 
            banks.push({
                
                logoUrl: row.logoUrl,
                bankNames: row.bankNames,
                products: row.products ? row.products.split(/\s+/).join(',') : '',
            });
        });

        stream.on('end', async () => {
            try {
                await Bank.insertMany(banks);
                res.status(201).json({ message: "CSV data uploaded successfully!", data: banks });
            } catch (err) {
                res.status(500).json({ message: "Error saving data to database", error: err.message });
            } finally {
                // Delete file AFTER data is inserted
                fs.unlink(filePath, (err) => {
                    if (err) console.error("Error deleting file:", err);
                    else console.log("File deleted successfully");
                });
            }
        });

        stream.on('error', (err) => {
            console.error("Error reading CSV:", err);
            res.status(500).json({ message: "Error reading CSV file", error: err.message });
        });

    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ message: "Unexpected error occurred", error: err.message });
    }
};
