const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

async function convertArrayToMap(documentId) {
  const collectionName = "pincode_services"; // Replace with your collection name
  const fieldName = "pincode"; // Replace with your field name

  try {
    const docRef = firestore.collection(collectionName).doc(documentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error(`Document with ID '${documentId}' not found!`);
      return;
    }

    const data = doc.data();
    const pincodeArray = data[fieldName];

    if (!Array.isArray(pincodeArray)) {
      console.error(`Pincode field in document '${documentId}' is not a valid array!`);
      return;
    }

    // Convert array to a map
    const pincodeMap = {};
    pincodeArray.forEach((pincode) => {
      if (typeof pincode === "string" || typeof pincode === "number") {
        pincodeMap[pincode] = true; // Use pin code as key with value 'true'
      }
    });

    // Update the document with the map
    await docRef.update({
      pincode_map: pincodeMap, // Save the new map in a different field
      [fieldName]: admin.firestore.FieldValue.delete(), // Optionally delete the original array
    });

    console.log(`Successfully converted pincode array to map for document '${documentId}'.`);
  } catch (error) {
    console.error(`Error processing document '${documentId}':`, error.message);
  }
}

// Call the function for a specific document
convertArrayToMap("DBS Bank"); // Replace with your document ID
