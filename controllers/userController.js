const {db} = require ('../config/firebaseConfig');
const admin = require ('firebase-admin');


const checkReferrelcode = async(req, res) => {
    try {
      //  const { referralCode } = req.body;
        const referralCode = req.query.referralCode;
    
        // Validate request
        if (!referralCode) {
          return res.status(400).json({ success: false, message: 'Referral code is required' });
        }
    
        // Query Firestore to check if referral code exists
        const querySnapshot = await db.collection('users')
          .where('referral_code', '==', referralCode)
          .get();
    
        // Check if the query returned any results
        if (!querySnapshot.empty) {
          return res.status(200).json({ success: true, isValid: true });
        } else {
          return res.status(200).json({ success: true, isValid: false });
        }
      } catch (error) {
        console.error('Error checking referral code:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
      }

}




module.exports = {
    checkReferrelcode,
}