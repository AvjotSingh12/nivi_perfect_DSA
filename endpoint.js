// API Endpoint to check pincode and return bank document IDs
app.get('/checkPincode', async (req, res) => {
    const userPincode = req.query.pincode; // Get the pincode from query params
  
    if (!userPincode) {
      return res.status(400).json({ error: 'Pincode is required' });
    }
  
    try {
      // Query Firestore to get all bank documents
      const banksSnapshot = await db.collection('Test1').get();
      let matchingBanks = [];
  
      banksSnapshot.forEach(doc => {
        const pincodes = doc.data().pincode; // Get the pincodes array from the document
  
        // Check if the user's pincode exists in the array
        if (pincodes.includes(userPincode)) {
          matchingBanks.push(doc.id); // Add the document ID (bank ID) to the list
        }
      });
  
      if (matchingBanks.length > 0) {
        // If there are matching banks, return the list
        res.json({ message: 'Banks found', banks: matchingBanks });
      } else {
        // If no banks found for the pincode
        res.json({ message: 'No banks found for this pincode', banks: [] });
      }
  
    } catch (error) {
      console.error('Error fetching data from Firestore:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  