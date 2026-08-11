const { db } = require("../config/firebase");

const USERS_COLLECTION = "users";
const TRANSACTIONS_COLLECTION = "transactions";

const DAILY_BONUS = 50;
const BONUS_COOLDOWN = 24 * 60 * 60 * 1000;

async function claimDailyBonus(userId) {
  const userRef = db
    .collection(USERS_COLLECTION)
    .doc(String(userId));

  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return {
      success: false,
      message: "User account not found."
    };
  }

  const user = userDoc.data();

  const now = new Date();

  let lastClaim = null;

  if (user.dailyBonusClaimedAt) {
    lastClaim = user.dailyBonusClaimedAt.toDate
      ? user.dailyBonusClaimedAt.toDate()
      : new Date(user.dailyBonusClaimedAt);
  }

  if (lastClaim) {
    const elapsed = now.getTime() - lastClaim.getTime();

    if (elapsed < BONUS_COOLDOWN) {
      const remaining = BONUS_COOLDOWN - elapsed;

      const hours = Math.floor(
        remaining / (60 * 60 * 1000)
      );

      const minutes = Math.floor(
        (remaining % (60 * 60 * 1000)) /
        (60 * 1000)
      );

      return {
        success: false,
        cooldown: true,
        message:
          `⏳ You already claimed your daily bonus.\n\n` +
          `Come back in ${hours}h ${minutes}m.`
      };
    }
  }

  const currentBalance = Number(user.balance || 0);
  const currentTotalEarned = Number(user.totalEarned || 0);

  const newBalance = currentBalance + DAILY_BONUS;
  const newTotalEarned =
    currentTotalEarned + DAILY_BONUS;

  await userRef.update({
    balance: newBalance,
    totalEarned: newTotalEarned,
    dailyBonusClaimedAt: now,
    updatedAt: now
  });

  const transactionRef = db
    .collection(TRANSACTIONS_COLLECTION)
    .doc();

  await transactionRef.set({
    userId: String(userId),
    type: "daily_bonus",
    amount: DAILY_BONUS,
    status: "completed",
    description: "Daily bonus",
    createdAt: now
  });

  return {
    success: true,
    amount: DAILY_BONUS,
    balance: newBalance
  };
}

module.exports = {
  claimDailyBonus,
  DAILY_BONUS
};
