const { db } = require("../config/firebase");

const TRANSACTIONS_COLLECTION = "transactions";

async function getUserTransactions(userId, limit = 10) {
  const snapshot = await db
    .collection(TRANSACTIONS_COLLECTION)
    .where("userId", "==", String(userId))
    .limit(limit)
    .get();

  const transactions = [];

  snapshot.forEach((doc) => {
    const data = doc.data();

    transactions.push({
      id: doc.id,
      ...data
    });
  });

  transactions.sort((a, b) => {
    const aTime = a.createdAt?.toDate
      ? a.createdAt.toDate().getTime()
      : 0;

    const bTime = b.createdAt?.toDate
      ? b.createdAt.toDate().getTime()
      : 0;

    return bTime - aTime;
  });

  return transactions;
}

module.exports = {
  getUserTransactions
};
