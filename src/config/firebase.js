const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccountPath = path.join(
  __dirname,
  "../../serviceAccountKey.json"
);

if (!getApps().length) {
  initializeApp({
    credential: cert(require(serviceAccountPath))
  });
}

const db = getFirestore();

module.exports = {
  db
};
