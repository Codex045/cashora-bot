const express = require("express");
const crypto = require("crypto");

const { creditReward } = require("../services/rewardService");

const router = express.Router();

const ALLOWED_PROVIDERS = new Set([
  "wannads",
  "kiwiwall",
  "cpx",
  "monlix",
  "cpagrip",
  "adgem"
]);

function timingSafeEqual(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function getSecret(provider) {
  const secrets = {
    wannads: process.env.WANNADS_POSTBACK_SECRET,
    kiwiwall: process.env.KIWIWALL_POSTBACK_SECRET,
    cpx: process.env.CPX_POSTBACK_SECRET,
    monlix: process.env.MONLIX_POSTBACK_SECRET,
    cpagrip: process.env.CPAGRIP_POSTBACK_SECRET,
    adgem: process.env.ADGEM_POSTBACK_SECRET
  };

  return secrets[provider];
}

// =====================================================
// WANNADS POSTBACK
// GET /api/postback/wannads
// =====================================================

router.get("/wannads", async (req, res) => {
  try {
    const {
      user_id,
      reward,
      status,
      offer_id,
      offer_name,
      aff_sub,
      aff_sub2,
      aff_sub3,
      aff_sub4,
      goal_id,
      goal_name,
      transaction_id,
      ip,
      payout,
      signature
    } = req.query;

    console.log("📥 Wannads postback received:", {
      user_id,
      reward,
      status,
      offer_id,
      transaction_id
    });

    // ---------------------------------------------
    // REQUIRED PARAMETERS
    // ---------------------------------------------

    if (!user_id) {
      return res.status(400).send("Missing user_id");
    }

    if (!transaction_id) {
      return res.status(400).send("Missing transaction_id");
    }

    if (reward === undefined || reward === null || reward === "") {
      return res.status(400).send("Missing reward");
    }

    if (!signature) {
      return res.status(401).send("Missing signature");
    }

    // ---------------------------------------------
    // GET WANNADS SECRET
    // ---------------------------------------------

    const secret = process.env.WANNADS_POSTBACK_SECRET;

    if (!secret) {
      console.error("❌ WANNADS_POSTBACK_SECRET is missing");
      return res.status(500).send("Wannads configuration missing");
    }

    // ---------------------------------------------
    // WANNADS SIGNATURE
    //
    // MD5(user_id + transaction_id + reward + SECRET)
    // ---------------------------------------------

    const signaturePayload =
      String(user_id) +
      String(transaction_id) +
      String(reward) +
      String(secret);

    const expectedSignature = crypto
      .createHash("md5")
      .update(signaturePayload)
      .digest("hex");

    if (
      !timingSafeEqual(
        String(signature).toLowerCase(),
        expectedSignature.toLowerCase()
      )
    ) {
      console.error("❌ Invalid Wannads signature");

      return res.status(401).send("Invalid signature");
    }

    // ---------------------------------------------
    // NORMALIZE REWARD
    // ---------------------------------------------

    let amount = Number(reward);

    if (!Number.isFinite(amount)) {
      return res.status(400).send("Invalid reward");
    }

    // ---------------------------------------------
    // HANDLE CREDIT / REJECTION
    // ---------------------------------------------

    const normalizedStatus = String(status || "credited")
      .toLowerCase()
      .trim();

    if (normalizedStatus === "rejected") {
      if (amount > 0) {
        amount = -amount;
      }
    } else if (normalizedStatus === "credited") {
      if (amount < 0) {
        amount = Math.abs(amount);
      }
    } else {
      console.warn(
        `⚠️ Unknown Wannads status: ${normalizedStatus}`
      );

      return res.status(400).send("Invalid status");
    }

    // ---------------------------------------------
    // IMPORTANT:
    // Credit and rejection must be distinguishable
    // because Wannads can send the same transaction ID
    // again when a lead is rejected.
    // ---------------------------------------------

    const processingTransactionId =
      normalizedStatus === "rejected"
        ? `${transaction_id}:rejected`
        : `${transaction_id}:credited`;

    // ---------------------------------------------
    // CREDIT / DEBIT USER
    // ---------------------------------------------

    const result = await creditReward({
      provider: "wannads",
      userId: String(user_id),
      transactionId: processingTransactionId,
      amount,
      description:
        normalizedStatus === "rejected"
          ? `Wannads rejected: ${offer_name || "Offer"}`
          : `Wannads completed: ${offer_name || "Offer"}`
    });

    // ---------------------------------------------
    // DUPLICATE
    // ---------------------------------------------

    if (result.duplicate) {
      console.log(
        `ℹ️ Wannads duplicate transaction: ${processingTransactionId}`
      );

      return res.status(200).send("OK");
    }

    // ---------------------------------------------
    // SUCCESS
    // ---------------------------------------------

    console.log(
      `✅ Wannads ${normalizedStatus}:`,
      {
        userId: user_id,
        transactionId: transaction_id,
        amount,
        offerId: offer_id,
        offerName: offer_name,
        balance: result.balance
      }
    );

    // Wannads requires exactly OK or 1
    return res.status(200).send("OK");

  } catch (error) {
    console.error("❌ Wannads postback error:", error);

    return res.status(500).send("ERROR");
  }
});

// =====================================================
// GENERIC POSTBACK
// POST /api/postback
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      provider,
      user_id,
      transaction_id,
      amount,
      signature
    } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: "Provider is required."
      });
    }

    const cleanProvider =
      String(provider).toLowerCase().trim();

    if (!ALLOWED_PROVIDERS.has(cleanProvider)) {
      return res.status(400).json({
        success: false,
        error: "Unsupported provider."
      });
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "user_id is required."
      });
    }

    if (!transaction_id) {
      return res.status(400).json({
        success: false,
        error: "transaction_id is required."
      });
    }

    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        error: "amount is required."
      });
    }

    const secret = getSecret(cleanProvider);

    if (secret) {
      if (!signature) {
        return res.status(401).json({
          success: false,
          error: "Missing signature."
        });
      }

      const payload =
        `${cleanProvider}:${user_id}:${transaction_id}:${amount}`;

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      if (
        !timingSafeEqual(
          signature,
          expectedSignature
        )
      ) {
        return res.status(401).json({
          success: false,
          error: "Invalid signature."
        });
      }
    }

    const result = await creditReward({
      provider: cleanProvider,
      userId: user_id,
      transactionId: transaction_id,
      amount: Number(amount),
      description:
        `${cleanProvider} completed earning`
    });

    if (result.duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: "Transaction already processed."
      });
    }

    return res.status(200).json({
      success: true,
      provider: cleanProvider,
      amount: result.amount,
      balance: result.balance,
      transaction_id: result.transactionId
    });

  } catch (error) {
    console.error("❌ Postback error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to process reward."
    });
  }
});

module.exports = router;
