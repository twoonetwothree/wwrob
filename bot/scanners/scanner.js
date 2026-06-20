const { fetchRecentTrades } = require("../trackers/trades");
const { saveTrade } = require("../wallets/walletTracker");
const { scoreWallet } = require("../wallets/walletScoring");
const { getWalletGrade } = require("../wallets/walletGrade");
const { sendWalletAlert } = require("../alerts/walletAlert");
const { sendSimpleTradeAlert } = require("../alerts/simpleTradeAlert");
const { updateStats } = require("../logs/statsLogger");

const MIN_SAVE_VALUE = 1;
const SCANNER_POST_VALUE = 1;
const PRE_ALERT_VALUE = 100;
const FRESH_VALUE = 250;
const WHALE_VALUE = 1000;

const MAX_SCANNER_POSTS = 6;
const MAX_ALERTS = 6;
const DISCORD_SEND_TIMEOUT_MS = 7000;

async function withTimeout(promise, label) {
  try {
    await Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out`)), DISCORD_SEND_TIMEOUT_MS)
      ),
    ]);

    return true;
  } catch (error) {
    console.error(`${label} failed: ${error.message}`);
    return false;
  }
}

async function runScanner(channels) {
  console.log("RWTCH scanner running");

  const trades = await fetchRecentTrades(3000);

  let saved = 0;
  let duplicate = 0;
  let small = 0;
  let scannerPosts = 0;
  let alerts = 0;

  for (const trade of trades.reverse()) {
    if (!trade.wallet || !trade.id) continue;

    const tradeValue = Number(trade.value || trade.size * trade.price || 0);

    if (tradeValue < MIN_SAVE_VALUE) {
      small++;
      continue;
    }

    const wallet = saveTrade(trade);

    if (!wallet) {
      duplicate++;
      continue;
    }

    saved++;

    const score = scoreWallet(wallet);
    const grade = getWalletGrade(wallet, score);

    if (scannerPosts < MAX_SCANNER_POSTS && tradeValue >= SCANNER_POST_VALUE) {
      await withTimeout(
        sendSimpleTradeAlert(channels.scanner, wallet, trade, score, grade),
        "scanner post"
      );

      scannerPosts++;
    }

    if (alerts >= MAX_ALERTS) continue;

    const isFresh = wallet.trade_count <= 3 && tradeValue >= FRESH_VALUE;
    const isWhale = tradeValue >= WHALE_VALUE || grade.channelType === "whale";
    const isTop = grade.channelType === "top";
    const isSmart = grade.channelType === "smart";
    const isPreAlert = tradeValue >= PRE_ALERT_VALUE && score >= 25;

    if (isFresh && channels.fresh) {
      await withTimeout(
        sendWalletAlert(channels.fresh, wallet, trade, score, grade),
        "fresh alert"
      );

      alerts++;
      continue;
    }

    if (isWhale && channels.whale) {
      await withTimeout(
        sendWalletAlert(channels.whale, wallet, trade, score, grade),
        "whale alert"
      );

      alerts++;
      continue;
    }

    if (isTop && channels.top) {
      await withTimeout(
        sendWalletAlert(channels.top, wallet, trade, score, grade),
        "top trader alert"
      );

      alerts++;
      continue;
    }

    if (isSmart && channels.smart) {
      await withTimeout(
        sendWalletAlert(channels.smart, wallet, trade, score, grade),
        "smart wallet alert"
      );

      alerts++;
      continue;
    }

    if (isPreAlert && channels.preAlert) {
      await withTimeout(
        sendWalletAlert(channels.preAlert, wallet, trade, score, grade),
        "pre alert"
      );

      alerts++;
    }
  }

  updateStats({
    tradesProcessed: saved,
    alertsPosted: alerts,
  });

  console.log(`
RWTCH SCAN
Fetched: ${trades.length}
Saved: ${saved}
Duplicate: ${duplicate}
Small: ${small}
Scanner Posts: ${scannerPosts}
Alerts: ${alerts}
`);
}

module.exports = { runScanner };