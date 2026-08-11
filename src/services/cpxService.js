const crypto = require("crypto");

const CPX_APP_ID = process.env.CPX_APP_ID;

function createCpxSurveyUrl(userId) {
  if (!CPX_APP_ID) {
    throw new Error("CPX_APP_ID is missing.");
  }

  const cleanUserId = String(userId);

  const secureHashSecret =
    process.env.CPX_SECURE_HASH;

  let secureHash = "";

  if (secureHashSecret) {
    secureHash = crypto
      .createHash("md5")
      .update(
        `${cleanUserId}-${secureHashSecret}`
      )
      .digest("hex");
  }

  const params = new URLSearchParams({
    app_id: CPX_APP_ID,
    ext_user_id: cleanUserId
  });

  if (secureHash) {
    params.set("secure_hash", secureHash);
  }

  return (
    "https://offers.cpx-research.com/index.php?" +
    params.toString()
  );
}

module.exports = {
  createCpxSurveyUrl
};
