const { db } = require("../config/firebase");

const USERS_COLLECTION = "users";

async function createOrGetUser(telegramUser, referredBy = null) {
  const userId = String(telegramUser.id);

  // Prevent self-referral
  if (referredBy && String(referredBy) === userId) {
    referredBy = null;
  }

  const userRef = db.collection(USERS_COLLECTION).doc(userId);
  const userDoc = await userRef.get();

  // Existing user
  if (userDoc.exists) {
    return userDoc.data();
  }

  const userData = {
    telegramId: telegramUser.id,
    firstName: telegramUser.first_name || "",
    lastName: telegramUser.last_name || "",
    username: telegramUser.username || null,

    balance: 0,
    pendingBalance: 0,

    totalEarned: 0,
    totalWithdrawn: 0,

    referralCode: userId,
    referredBy: referredBy || null,

    referralCount: 0,
    referralEarnings: 0,

    dailyBonusClaimedAt: null,

    status: "active",

    createdAt: new Date(),
    updatedAt: new Date()
  };

  await userRef.set(userData);

  // Add referral to the referrer
  if (referredBy) {
    const referrerRef = db
      .collection(USERS_COLLECTION)
      .doc(String(referredBy));

    const referrerDoc = await referrerRef.get();

    if (referrerDoc.exists) {
      await referrerRef.update({
        referralCount:
          Number(referrerDoc.data().referralCount || 0) + 1,

        updatedAt: new Date()
      });
    }
  }

  return userData;
}

async function getUser(userId) {
  const userRef = db
    .collection(USERS_COLLECTION)
    .doc(String(userId));

  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return null;
  }

  return userDoc.data();
}

module.exports = {
  createOrGetUser,
  getUser
};
