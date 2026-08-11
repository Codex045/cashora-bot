const express = require("express");
const crypto = require("crypto");

const { creditReward } = require("../services/rewardService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const {
      status,
      trans_id,
      user_id,
      subid_1,
      subid_2,
      amount_local,
      amount_usd,
      offer_id,
      secure_hash,
      ip_click,
      type
    } = req.query;

    console.log("📥 CPX Postback:", {
      status,
      trans_id,
      user_id,
      amount_local,
      amount_usd,
      offer_id,
      type
    });

    // Required parameters
    if (!trans_id) {
      return res.status(400).send("Missing trans_id");
    }

    if (!user_id) {
      return res.status(400).send("Missing user_id");
    }

    if (!status) {
      return res.status(400).send("Missing status");
    }

    // CPX:
    // 1 = completed
    // 2 = cancelled
    if (String(status) === "2") {
      console.log(
        `↩️ CPX transaction cancelled: ${trans_id}`
      );

      return res.status(200).send("OK");
    }

    if (String(status) !== "1") {
      return res.status(200).send("OK");
    }

    // Amount in Cashora's currency
    const reward = Number(amount_local);

    if (!Number.isFinite(reward) || reward <= 0) {
      return res.status(400).send("Invalid amount_local");
    }

    // Validate CPX secure hash
    const appSecureHash =
      process.env.CPX_SECURE_HASH;

    if (!appSecureHash) {
      console.error(
        "❌ CPX_SECURE_HASH is missing"
      );

      return res
        .status(500)
        .send("CPX security configuration missing");
    }

    if (!secure_hash) {
      return res.status(401).send("Missing secure_hash");
    }

    const expectedHash = crypto
      .createHash("md5")
      .update(
        `${trans_id}-${appSecureHash}`
      )
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(String(secure_hash)),
        Buffer.from(expectedHash)
      )
    ) {
      console.error(
        `❌ Invalid CPX hash for transaction ${trans_id}`
      );

      return res.status(401).send("Invalid secure_hash");
    }

    // Credit the user's Cashora account
    const result = await creditReward({
      provider: "cpx",
      userId: user_id,
      transactionId: trans_id,
      amount: reward,
      description:
        `CPX Research survey${offer_id ? ` #${offer_id}` : ""}`
    });

    // Duplicate transactions are already safely processed
    if (result.duplicate) {
      console.log(
        `⚠️ Duplicate CPX transaction: ${trans_id}`
      );

      return res.status(200).send("OK");
    }

    console.log(
      `✅ CPX reward credited: ${user_id} +₦${reward}`
    );

    return res.status(200).send("OK");

  } catch (error) {
    console.error(
      "❌ CPX postback error:",
      error
    );

    return res.status(500).send("Postback failed");
  }
});

module.exports = router;
