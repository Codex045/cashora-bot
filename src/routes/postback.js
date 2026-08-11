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

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer
  );
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

/*
 * POST /api/postback
 *
 * Expected body:
 *
 * {
 *   "provider": "cpx",
 *   "user_id": "8765678121",
 *   "transaction_id": "ABC123",
 *   "amount": 100,
 *   "signature": "..."
 * }
 */
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

    if (
      amount === undefined ||
      amount === null
    ) {
      return res.status(400).json({
        success: false,
        error: "amount is required."
      });
    }

    /*
     * Signature verification is only performed
     * when a provider secret has been configured.
     */
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

      const expectedSignature =
        crypto
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
    console.error(
      "❌ Postback error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Unable to process reward."
    });
  }
});

module.exports = router;
