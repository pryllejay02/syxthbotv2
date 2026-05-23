const admin = require("firebase-admin");
const serviceAccount = require("./syxthbot-firebase-adminsdk-fbsvc-b5e1bcea28.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db };