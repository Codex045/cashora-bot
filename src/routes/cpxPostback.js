const express = require("express");
const crypto = require("crypto");

const { creditReward } = require("../services/rewardService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const {
      ext_user_id,
      trans_id,
      amount,
      status,
      hash
    } = req.query;

    console.log("📥 CPX Postback:", req.query);

    if (!ext_user_id) {
      return res.status(400).send("Missing ext_user_id");
    }

    if (!trans_id) {
      return res.status(400).send("Missing trans_id");
    }

    if (!amount) {
      return res.status(400).send("Missing amount");
    }

    /*
     * CPX can send different statuses.
     * Only completed/approved rewards should
     * increase the user's balance.
     */
    if (
      status &&
      !["1", "complete", "completed", "approved"]
        .includes(String(status).toLowerCase())
    ) {
      return res.status(200).send("OK");
    }

    const reward = Number(amount);

    if (!Number.isFinite(reward) || reward <= 0) {
      return res.status(400).send("Invalid amount");
    }

    /*
     * CPX postback security.
     *
     * The exact CPX hash format must match the
     * format shown in your CPX Postback Settings.
     */
    const secret =
      process.env.CPX_POSTBACK_SECRET;

    if (secret && hash) {
      const expectedHash = crypto
        .createHash("md5")
        .update(
          `${ext_user_id}-${trans_id}-${amount}-${secret}`
        )
        .digest("hex");

      if (expectedHash !== String(hash)) {
        console.error("❌ Invalid CPX hash");

        return res
          .status(401)
          .send("Invalid hash");
      }
    }

    const result = await creditReward({
      provider: "cpx",
      userId: ext_user_id,
      transactionId: trans_id,
      amount: reward,
      description: "CPX Research survey"
    });

    if (result.duplicate) {
      return res.status(200).send("OK");
    }

    console.log(
      `✅ CPX reward: ${ext_user_id} +₦${reward}`
    );

    return res.status(200).send("OK");

  } catch (error) {
    console.error(
      "❌ CPX postback error:",
      error
    );

    return res
      .status(500)
      .send("Postback failed");
  }
});

module.exports = router;
