const { EmbedBuilder } = require("discord.js");
const { fetchRecentTrades } = require("../trackers/trades");
const { saveTrade } = require("../wallets/walletTracker");
const { scoreWallet } = require("../wallets/walletScoring");
const { getWalletGrade } = require("../wallets/walletGrade");
const { sendWalletAlert } = require("../alerts/walletAlert");
const { sendSimpleTradeAlert } = require("../alerts/simpleTradeAlert");
const { updateStats } = require("../logs/statsLogger");
const { analyzeBestTrades, buildTradeStudyEmbed } = require("../analysis/tradeAnalyzer");
const { sendWalletProfileReport } = require("../alerts/walletProfileAlert");

const MIN_SAVE_VALUE = 1;

const FRESH_VALUE = 250;
const SMART_VALUE = 100;
const TOP_VALUE = 250;
const WHALE_VALUE = 10000;
const PRE_ALERT_VALUE = 100;

const MAX_SCANNER_POSTS = 6;
const MAX_ALERTS = 10;
const DISCORD_SEND_TIMEOUT_MS = 7000;

const COORDINATED_MIN_WALLETS = 3;
const COORDINATED_MIN_VOLUME = 500;
const COORDINATED_MAX_POSTS = 3;

let scanCount = 0;
const marketActivity = new Map();

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

function trackMarketActivity(trade, tradeValue) {
  const key = trade.slug || trade.market || "unknown";

  if (!marketActivity.has(key)) {
    marketActivity.set(key, {
      market: trade.market || "Unknown Market",
      slug: trade.slug || "",
      volume: 0,
      trades: 0,
      wallets: new Set(),
    });
  }

  const item = marketActivity.get(key);

  item.volume += tradeValue;
  item.trades += 1;

  if (trade.wallet) {
    item.wallets.add(trade.wallet);
  }
}

function trackCoordinatedActivity(map, trade, tradeValue) {
  const key = `${trade.slug || trade.market || "unknown"}:${trade.outcome || "unknown"}:${trade.side || "unknown"}`;

  if (!map.has(key)) {
    map.set(key, {
      market: trade.market || "Unknown Market",
      slug: trade.slug || "",
      outcome: trade.outcome || "UNKNOWN",
      side: trade.side || "UNKNOWN",
      volume: 0,
      trades: 0,
      wallets: new Set(),
    });
  }

  const item = map.get(key);

  item.volume += tradeValue;
  item.trades += 1;

  if (trade.wallet) {
    item.wallets.add(trade.wallet);
  }
}

async function postActiveMarkets(channel) {
  const ranked = [...marketActivity.values()]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);

  if (ranked.length === 0) return;

  const lines = ranked.map((item, index) => {
    return [
      `${index + 1}. ${item.market}`,
      `Volume: $${item.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      `Trades: ${item.trades}`,
      `Unique wallets: ${item.wallets.size}`,
    ].join("\n");
  });

  await withTimeout(
    channel.send(`Top Active Markets\n\n${lines.join("\n\n")}`),
    "active markets post"
  );

  marketActivity.clear();
}

async function postCoordinatedTrades(channel, coordinatedMap) {
  const ranked = [...coordinatedMap.values()]
    .filter((item) => {
      return item.wallets.size >= COORDINATED_MIN_WALLETS && item.volume >= COORDINATED_MIN_VOLUME;
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, COORDINATED_MAX_POSTS);

  for (const item of ranked) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("Coordinated Trade Signal")
      .addFields(
        { name: "Market", value: item.market.slice(0, 1024) },
        { name: "Side", value: item.side, inline: true },
        { name: "Outcome", value: item.outcome, inline: true },
        {
          name: "Combined Volume",
          value: `$${item.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          inline: true,
        },
        { name: "Trades", value: `${item.trades}`, inline: true },
        { name: "Unique Wallets", value: `${item.wallets.size}`, inline: true }
      )
      .setFooter({ text: "RWTCH Coordinated Trade Engine" })
      .setTimestamp();

    if (item.slug) {
      embed.setURL(`https://polymarket.com/event/${item.slug}`);
    }

    await withTimeout(
      channel.send({ embeds: [embed] }),
      "coordinated trade post"
    );
  }
}

async function postBestTrades(channel, trades) {
  if (!channel) return;

  const studies = analyzeBestTrades(trades, { onlyUfc: false });

  for (const study of studies) {
    await withTimeout(
      channel.send({ embeds: [buildTradeStudyEmbed(study)] }),
      "best trade study post"
    );
  }
}

async function postUfcTrades(channel, trades) {
  if (!channel) return;

  const studies = analyzeBestTrades(trades, { onlyUfc: true });

  for (const study of studies) {
    await withTimeout(
      channel.send({ embeds: [buildTradeStudyEmbed(study)] }),
      "ufc trade study post"
    );
  }
}

async function runScanner(channels) {
  console.log("RWTCH scanner running");

  scanCount++;

  const trades = await fetchRecentTrades(3000);
  const coordinatedMap = new Map();

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

    trackMarketActivity(trade, tradeValue);
    trackCoordinatedActivity(coordinatedMap, trade, tradeValue);

    const wallet = saveTrade(trade);

    if (!wallet) {
      duplicate++;
      continue;
    }

    saved++;

    const score = scoreWallet(wallet);
    const grade = getWalletGrade(wallet, score);

    if (scannerPosts < MAX_SCANNER_POSTS && tradeValue >= 1) {
      await withTimeout(
        sendSimpleTradeAlert(channels.scanner, wallet, trade, score, grade),
        "scanner post"
      );

      scannerPosts++;
    }

    if (alerts >= MAX_ALERTS) continue;

    const isWhaleTrade = tradeValue >= WHALE_VALUE;
    const isFreshWallet = wallet.trade_count <= 3 && tradeValue >= FRESH_VALUE;

    const isTopTrader =
      tradeValue >= TOP_VALUE &&
      (score >= 85 || grade.grade === "A" || grade.grade === "S");

    const isSmartWallet =
      tradeValue >= SMART_VALUE &&
      wallet.trade_count >= 10 &&
      score >= 65 &&
      !isTopTrader;

    const isPreAlert =
      tradeValue >= PRE_ALERT_VALUE &&
      score >= 25 &&
      !isWhaleTrade &&
      !isFreshWallet &&
      !isTopTrader &&
      !isSmartWallet;

    if (isWhaleTrade && channels.whale) {
      await withTimeout(
        sendWalletAlert(channels.whale, wallet, trade, score, grade),
        "whale alert"
      );

      alerts++;
      continue;
    }

    if (isFreshWallet && channels.fresh) {
      await withTimeout(
        sendWalletAlert(channels.fresh, wallet, trade, score, grade),
        "fresh alert"
      );

      alerts++;
      continue;
    }

    if (isTopTrader && channels.top) {
      await withTimeout(
        sendWalletAlert(channels.top, wallet, trade, score, grade),
        "top trader alert"
      );

      alerts++;
      continue;
    }

    if (isSmartWallet && channels.smart) {
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

  if (channels.coordinated) {
    await postCoordinatedTrades(channels.coordinated, coordinatedMap);
  }

  if (scanCount % 6 === 0 && channels.scanner) {
    await postActiveMarkets(channels.scanner);
  }

  if (scanCount % 12 === 0 && channels.bestTrades) {
    await postBestTrades(channels.bestTrades, trades);
  }

  if (scanCount % 12 === 0 && channels.ufcTrades) {
    await postUfcTrades(channels.ufcTrades, trades);
  }

  if (scanCount % 30 === 0 && channels.profiles) {
    await withTimeout(
      sendWalletProfileReport(channels.profiles),
      "wallet profile report"
    );
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