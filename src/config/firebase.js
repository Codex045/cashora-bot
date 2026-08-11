const fs = require("fs");
const path = require("path");

const {
  initializeApp,
  cert,
  getApps
} = require("firebase-admin/app");

const {
  getFirestore
} = require("firebase-admin/firestore");

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT
    );
  } catch (error) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT contains invalid JSON."
    );
  }
} else {
  const localKeyPath = path.join(
    __dirname,
    "../../serviceAccountKey.json"
  );

  if (!fs.existsSync(localKeyPath)) {
    throw new Error(
      "Firebase credentials not found. " +
      "Add FIREBASE_SERVICE_ACCOUNT to the environment " +
      "or provide serviceAccountKey.json locally."
    );
  }

  serviceAccount = require(localKeyPath);
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
