const { db } = require("../config/firebase");

const USERS_COLLECTION = "users";
const TRANSACTIONS_COLLECTION = "transactions";
const POSTBACKS_COLLECTION = "postbacks";

/**
 * Credit a completed earning transaction.
 *
 * provider:
 *   wannads
 *   kiwiwall
 *   cpx
 *   monlix
 *   cpagrip
 *   adgem
 *
 * userId:
 *   Telegram user ID
 *
 * transactionId:
 *   Unique transaction ID supplied by the provider
 *
 * amount:
 *   Reward amount in Naira
 */
async function creditReward({
  provider,
  userId,
  transactionId,
  amount,
  description = "Completed earning"
}) {
  if (!provider) {
    throw new Error("Provider is required.");
  }

  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!transactionId) {
    throw new Error("Transaction ID is required.");
  }

  const reward = Number(amount);

  if (!Number.isFinite(reward) || reward <= 0) {
    throw new Error("Invalid reward amount.");
  }

  const cleanUserId = String(userId);
  const cleanTransactionId = String(transactionId);

  const userRef = db
    .collection(USERS_COLLECTION)
    .doc(cleanUserId);

  const transactionRef = db
    .collection(TRANSACTIONS_COLLECTION)
    .doc();

  const postbackRef = db
    .collection(POSTBACKS_COLLECTION)
    .doc(
      `${provider}_${cleanTransactionId}`
    );

  /*
   * Firestore transaction guarantees that checking
   * and crediting happen atomically.
   */
  const result = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("User account not found.");
    }

    const postbackDoc = await transaction.get(postbackRef);

    /*
     * Duplicate protection.
     */
    if (postbackDoc.exists) {
      return {
        success: false,
        duplicate: true,
        message: "Reward already processed."
      };
    }

    const user = userDoc.data();

    const currentBalance =
      Number(user.balance || 0);

    const currentTotalEarned =
      Number(user.totalEarned || 0);

    const newBalance =
      currentBalance + reward;

    const newTotalEarned =
      currentTotalEarned + reward;

    const now = new Date();

    /*
     * Update user balance.
     */
    transaction.update(userRef, {
      balance: newBalance,
      totalEarned: newTotalEarned,
      updatedAt: now
    });

    /*
     * Record transaction.
     */
    transaction.set(transactionRef, {
      userId: cleanUserId,

      type: "earning",

      provider,

      providerTransactionId:
        cleanTransactionId,

      amount: reward,

      status: "completed",

      description,

      createdAt: now
    });

    /*
     * Record processed postback.
     */
    transaction.set(postbackRef, {
      provider,

      transactionId:
        cleanTransactionId,

      userId: cleanUserId,

      amount: reward,

      status: "processed",

      transactionDocument:
        transactionRef.id,

      createdAt: now
    });

    return {
      success: true,
      duplicate: false,
      amount: reward,
      balance: newBalance,
      transactionId: transactionRef.id
    };
  });

  return result;
}

module.exports = {
  creditReward
};
