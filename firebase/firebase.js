const admin = require("firebase-admin");
const serviceAccount = require("./syxthbot-firebase-adminsdk-fbsvc-98d95236d0.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db };