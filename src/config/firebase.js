const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountJson) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT environment variable is missing."
  );
}

let serviceAccount;

try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT contains invalid JSON."
  );
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

module.exports = {
  db
};
