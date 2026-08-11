require("dotenv").config();

const express = require("express");
const cors = require("cors");

const postbackRoutes = require("./routes/postback");
const cpxPostbackRoutes = require("./routes/cpxPostback");

const { Telegraf, Markup } = require("telegraf");
const { createOrGetUser, getUser } = require("./services/userService");
const {
  claimDailyBonus,
  DAILY_BONUS
} = require("./services/bonusService");

const {
  getUserTransactions
} = require("./services/transactionService");

const {
  createCpxSurveyUrl
} = require("./services/cpxService");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing from .env");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ===============================
// CASHORA API SERVER
// ===============================

const app = express();

const PORT = Number(process.env.PORT || 10000);

app.use(cors());

app.use(
  express.json({
    limit: "1mb"
  })
);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "Cashora Backend",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.use(
  "/api/postback/cpx",
  cpxPostbackRoutes
);

app.use(
  "/api/postback",
  postbackRoutes
);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Cashora API running on port ${PORT}`
  );
});

// ===============================
// MAIN MENU
// ===============================

const mainMenu = Markup.keyboard([
  ["💰 Balance", "🎯 Earn"],
  ["💳 Wallet", "📊 History"],
  ["👤 Profile", "🛠️ Support"]
]).resize();

// ===============================
// EARN MENU
// ===============================

const earnMenu = Markup.keyboard([
  ["📝 Surveys", "📋 Tasks"],
  ["🎁 Daily Bonus", "👥 Referrals"],
  ["🔙 Back"]
]).resize();

// ===============================
// START
// ===============================

bot.start(async (ctx) => {
  try {
    const user = ctx.from;

    // Telegram sends referral data after /start
    const startPayload = ctx.startPayload || null;

    let referredBy = null;

    if (startPayload) {
      const cleanPayload = String(startPayload).trim();

      if (/^\d+$/.test(cleanPayload)) {
        referredBy = cleanPayload;
      }
    }

    const account = await createOrGetUser(
      user,
      referredBy
    );

    const isNewUser =
      account.telegramId === user.id &&
      account.createdAt;

    await ctx.reply(
      `👋 Welcome to Cashora, ${user.first_name || "User"}!\n\n` +
      `💰 Your Cashora account is ready.\n\n` +
      `Complete surveys, tasks and offers to earn rewards.\n\n` +
      `Choose an option below:`,
      mainMenu
    );

    console.log(
      `👤 Cashora user: ${user.id}` +
      (referredBy ? ` | Referred by: ${referredBy}` : "")
    );

  } catch (error) {
    console.error("❌ Start error:", error);

    await ctx.reply(
      "⚠️ We couldn't load your Cashora account right now.\n\n" +
      "Please try again."
    );
  }
});

// ===============================
// BALANCE
// ===============================

bot.hears("💰 Balance", async (ctx) => {
  try {
    const user = await getUser(ctx.from.id);

    if (!user) {
      return ctx.reply(
        "⚠️ Your account was not found.\n\nUse /start first.",
        mainMenu
      );
    }

    await ctx.reply(
      "💰 Cashora Balance\n\n" +
      `Available Balance: ₦${Number(user.balance || 0).toFixed(2)}\n` +
      `Pending Balance: ₦${Number(user.pendingBalance || 0).toFixed(2)}\n\n` +
      `💵 Total Earned: ₦${Number(user.totalEarned || 0).toFixed(2)}`,
      mainMenu
    );

  } catch (error) {
    console.error("❌ Balance error:", error);

    await ctx.reply(
      "⚠️ Unable to load your balance.",
      mainMenu
    );
  }
});

// ===============================
// EARN
// ===============================

bot.hears("🎯 Earn", async (ctx) => {
  await ctx.reply(
    "🎯 Earn with Cashora\n\n" +
    "Choose an earning method:",
    earnMenu
  );
});

// ===============================
// SURVEYS
// ===============================

bot.hears("📝 Surveys", async (ctx) => {
  try {
    const user = await getUser(ctx.from.id);

    if (!user) {
      return ctx.reply(
        "⚠️ Use /start first.",
        mainMenu
      );
    }

    const cpxUrl =
      createCpxSurveyUrl(user.telegramId);

    await ctx.reply(
      "📝 Cashora Surveys\n\n" +
      "Complete available surveys and earn rewards.\n\n" +
      "Tap the button below to see surveys available for you.",
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "📝 Open Surveys",
            cpxUrl
          )
        ]
      ])
    );

  } catch (error) {
    console.error(
      "❌ CPX survey error:",
      error
    );

    await ctx.reply(
      "⚠️ Surveys are temporarily unavailable.",
      earnMenu
    );
  }
});

// ===============================
// TASKS
// ===============================

// ===============================
// TASKS / OFFERWALLS
// ===============================

bot.hears("📋 Tasks", async (ctx) => {
  await ctx.reply(
    "📋 Cashora Tasks\n\n" +
    "Choose an offerwall to start earning:",
    {
      reply_markup: {
        keyboard: [
          ["🟠 Wannads", "🟣 CPX Research"],
          ["🔙 Back"]
        ],
        resize_keyboard: true
      }
    }
  );
});

// ===============================
// WANNADS
// ===============================

bot.hears("🟠 Wannads", async (ctx) => {
  try {
    const userId = String(ctx.from.id);

    const url =
      `https://earn.wannads.com/wall?apiKey=${process.env.WANNADS_API_KEY}&userId=${encodeURIComponent(userId)}`;

    await ctx.reply(
      "🟠 Wannads Offerwall\n\n" +
      "Tap the link below to open available offers:\n\n" +
      url
    );
  } catch (error) {
    console.error("❌ Wannads error:", error);

    await ctx.reply(
      "❌ Unable to open Wannads right now."
    );
  }
});

// ===============================
// CPX RESEARCH
// ===============================

bot.hears("🟣 CPX Research", async (ctx) => {
  try {
    const userId = String(ctx.from.id);

    const url =
      `https://offers.cpx-research.com/index.php?app_id=${process.env.CPX_APP_ID}&ext_user_id=${encodeURIComponent(userId)}`;

    await ctx.reply(
      "🟣 CPX Research\n\n" +
      "Tap the link below to open available surveys:\n\n" +
      url
    );
  } catch (error) {
    console.error("❌ CPX Research error:", error);

    await ctx.reply(
      "❌ Unable to open CPX Research right now."
    );
  }
});

// ===============================
// DAILY BONUS
// ===============================

bot.hears("🎁 Daily Bonus", async (ctx) => {
  try {
    const result = await claimDailyBonus(ctx.from.id);

    if (!result.success) {
      return ctx.reply(
        result.message,
        earnMenu
      );
    }

    await ctx.reply(
      "🎉 Daily Bonus Claimed!\n\n" +
      `💰 Bonus: ₦${result.amount.toFixed(2)}\n` +
      `💵 New Balance: ₦${result.balance.toFixed(2)}\n\n` +
      "Come back tomorrow for another bonus!",
      earnMenu
    );

  } catch (error) {
    console.error("❌ Daily bonus error:", error);

    await ctx.reply(
      "⚠️ Unable to process your daily bonus right now.",
      earnMenu
    );
  }
});

// ===============================
// REFERRALS
// ===============================

bot.hears("👥 Referrals", async (ctx) => {
  try {
    const user = await getUser(ctx.from.id);

    if (!user) {
      return ctx.reply(
        "⚠️ Use /start first.",
        mainMenu
      );
    }

    const botInfo = await bot.telegram.getMe();

    const referralLink =
      `https://t.me/${botInfo.username}?start=${user.referralCode}`;

    const shareText =
      "Join me on Cashora and earn rewards by completing surveys, tasks and offers!";

    const shareUrl =
      `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;

    await ctx.reply(
      "👥 Cashora Referrals\n\n" +
      `👤 Referrals: ${user.referralCount || 0}\n` +
      `💰 Referral Earnings: ₦${Number(user.referralEarnings || 0).toFixed(2)}\n\n` +
      "🔗 Your referral link:\n" +
      `${referralLink}\n\n` +
      "Share your link with friends and earn when they qualify.",
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "📤 Share Referral Link",
            shareUrl
          )
        ],
        [
          Markup.button.callback(
            "🔄 Refresh",
            "refresh_referrals"
          )
        ]
      ])
    );

  } catch (error) {
    console.error("❌ Referral error:", error);

    await ctx.reply(
      "⚠️ Unable to load your referral information.",
      earnMenu
    );
  }
});

bot.action("refresh_referrals", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const user = await getUser(ctx.from.id);

    if (!user) {
      return ctx.editMessageText(
        "⚠️ Your Cashora account was not found."
      );
    }

    const botInfo = await bot.telegram.getMe();

    const referralLink =
      `https://t.me/${botInfo.username}?start=${user.referralCode}`;

    const shareText =
      "Join me on Cashora and earn rewards by completing surveys, tasks and offers!";

    const shareUrl =
      `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;

    await ctx.editMessageText(
      "👥 Cashora Referrals\n\n" +
      `👤 Referrals: ${user.referralCount || 0}\n` +
      `💰 Referral Earnings: ₦${Number(user.referralEarnings || 0).toFixed(2)}\n\n` +
      "🔗 Your referral link:\n" +
      `${referralLink}`,
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "📤 Share Referral Link",
            shareUrl
          )
        ],
        [
          Markup.button.callback(
            "🔄 Refresh",
            "refresh_referrals"
          )
        ]
      ])
    );

  } catch (error) {
    console.error("❌ Refresh referral error:", error);

    await ctx.answerCbQuery(
      "Unable to refresh referrals."
    );
  }
});

// ===============================
// BACK
// ===============================

bot.hears("🔙 Back", async (ctx) => {
  await ctx.reply(
    "🏠 Main Menu",
    mainMenu
  );
});

// ===============================
// WALLET
// ===============================

bot.hears("💳 Wallet", async (ctx) => {
  try {
    const user = await getUser(ctx.from.id);

    if (!user) {
      return ctx.reply(
        "⚠️ Use /start first.",
        mainMenu
      );
    }

    await ctx.reply(
      "💳 Cashora Wallet\n\n" +
      `Available: ₦${Number(user.balance || 0).toFixed(2)}\n\n` +
      "Withdrawal options will be connected next.",
      mainMenu
    );

  } catch (error) {
    console.error("❌ Wallet error:", error);

    await ctx.reply(
      "⚠️ Unable to load wallet.",
      mainMenu
    );
  }
});

// ===============================
// HISTORY
// ===============================

bot.hears("📊 History", async (ctx) => {
  try {
    const user = await getUser(ctx.from.id);

    if (!user) {
      return ctx.reply(
        "⚠️ Use /start first.",
        mainMenu
      );
    }

    const transactions =
      await getUserTransactions(
        ctx.from.id,
        10
      );

    if (transactions.length === 0) {
      return ctx.reply(
        "📊 Transaction History\n\n" +
        "You don't have any transactions yet.",
        mainMenu
      );
    }

    let message =
      "📊 Transaction History\n\n";

    for (const transaction of transactions) {
      const amount =
        Number(transaction.amount || 0)
          .toFixed(2);

      const provider =
        transaction.provider
          ? transaction.provider.toUpperCase()
          : "CASHORA";

      message +=
        `💰 +₦${amount}\n` +
        `📌 ${provider}\n` +
        `📝 ${transaction.description || "Earning"}\n` +
        `✅ ${transaction.status || "completed"}\n\n`;
    }

    message +=
      "Showing your latest transactions.";

    await ctx.reply(
      message,
      mainMenu
    );

  } catch (error) {
    console.error(
      "❌ History error:",
      error
    );

    await ctx.reply(
      "⚠️ Unable to load transaction history.",
      mainMenu
    );
  }
});

// ===============================
// PROFILE
// ===============================

bot.hears("👤 Profile", async (ctx) => {
  try {
    const user = await getUser(ctx.from.id);

    if (!user) {
      return ctx.reply(
        "⚠️ Use /start first.",
        mainMenu
      );
    }

    await ctx.reply(
      "👤 Cashora Profile\n\n" +
      `Name: ${user.firstName || "Not set"}\n` +
      `Username: ${user.username ? "@" + user.username : "Not set"}\n` +
      `Telegram ID: ${user.telegramId}\n\n` +
      `💰 Balance: ₦${Number(user.balance || 0).toFixed(2)}\n` +
      `💵 Total Earned: ₦${Number(user.totalEarned || 0).toFixed(2)}\n` +
      `👥 Referrals: ${user.referralCount || 0}`,
      mainMenu
    );

  } catch (error) {
    console.error("❌ Profile error:", error);

    await ctx.reply(
      "⚠️ Unable to load profile.",
      mainMenu
    );
  }
});

// ===============================
// SUPPORT
// ===============================

bot.hears("🛠️ Support", async (ctx) => {
  await ctx.reply(
    "🛠️ Cashora Support\n\n" +
    "If you have a problem with your account, transaction or reward, contact Cashora support.",
    mainMenu
  );
});

// ===============================
// COMMANDS
// ===============================

bot.command("balance", async (ctx) => {
  try {
    const user = await getUser(ctx.from.id);

    if (!user) {
      return ctx.reply("⚠️ Use /start first.", mainMenu);
    }

    await ctx.reply(
      `💰 Balance: ₦${Number(user.balance || 0).toFixed(2)}`,
      mainMenu
    );

  } catch (error) {
    console.error(error);
    await ctx.reply("⚠️ Unable to load balance.");
  }
});

bot.command("earn", async (ctx) => {
  await ctx.reply(
    "🎯 Choose an earning method:",
    earnMenu
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "🤖 Cashora Help\n\n" +
    "/start - Open Cashora\n" +
    "/balance - Check balance\n" +
    "/earn - Open earning menu\n" +
    "/help - Show help",
    mainMenu
  );
});

// ===============================
// UNKNOWN TEXT
// ===============================

bot.on("text", async (ctx) => {
  await ctx.reply(
    "Please use the Cashora menu buttons.",
    mainMenu
  );
});

// ===============================
// ERROR HANDLER
// ===============================

bot.catch((error) => {
  console.error("❌ Cashora bot error:", error);
});

// ===============================
// START BOT
// ===============================

bot.launch()
  .then(() => {
    console.log("🚀 Cashora bot is running...");
  })
  .catch((error) => {
    console.error("❌ Failed to start Cashora:", error);
    process.exit(1);
  });

// ===============================
// SAFE SHUTDOWN
// ===============================

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
