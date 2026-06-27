const { EmbedBuilder } = require("discord.js");
const db = require("../db/database");
const { scoreWallet } = require("../wallets/walletScoring");
const { getWalletGrade } = require("../wallets/walletGrade");

function isUfcMarket(market = "") {
  const text = String(market).toLowerCase();

  return (
    text.includes("ufc") ||
    text.includes("mma") ||
    text.includes("fight night") ||
    text.includes("dana white") ||
    text.includes("octagon") ||
    text.includes("knockout") ||
    text.includes("submission")
  );
}

function getTimestamp(trade) {
  return Number(trade.timestamp || 0);
}

function getWalletConfidence(walletAddress) {
  if (!walletAddress) {
    return {
      multiplier: 1,
      score: 0,
      grade: "Unknown",
      label: "Unknown Wallet",
    };
  }

  const wallet = db
    .prepare("SELECT * FROM wallets WHERE address = ?")
    .get(walletAddress);

  if (!wallet) {
    return {
      multiplier: 1,
      score: 0,
      grade: "Unknown",
      label: "Untracked Wallet",
    };
  }

  const score = scoreWallet(wallet);
  const grade = getWalletGrade(wallet, score);

  let multiplier = 1;

  if (grade.grade === "S") multiplier = 1.5;
  else if (grade.grade === "A") multiplier = 1.35;
  else if (grade.grade === "B") multiplier = 1.2;
  else if (grade.grade === "Fresh") multiplier = 1.08;

  return {
    multiplier,
    score,
    grade: grade.grade,
    label: grade.label,
  };
}

function analyzeBestTrades(trades, options = {}) {
  const markets = new Map();
  const onlyUfc = Boolean(options.onlyUfc);

  const now = Math.floor(Date.now() / 1000);
  const recentWindow = now - 15 * 60;
  const veryRecentWindow = now - 5 * 60;

  for (const trade of trades) {
    if (!trade.market || !trade.outcome || !trade.side) continue;
    if (onlyUfc && !isUfcMarket(trade.market)) continue;

    const value = Number(trade.value || trade.size * trade.price || 0);
    const price = Number(trade.price || 0);
    const side = String(trade.side || "").toUpperCase();
    const timestamp = getTimestamp(trade);

    if (value < 10 || price <= 0 || price >= 1) continue;

    const walletConfidence = getWalletConfidence(trade.wallet);
    const weightedValue = value * walletConfidence.multiplier;

    const key = `${trade.slug || trade.market}:${trade.outcome}`;

    if (!markets.has(key)) {
      markets.set(key, {
        market: trade.market,
        slug: trade.slug || "",
        outcome: trade.outcome,

        volume: 0,
        weightedVolume: 0,

        buyVolume: 0,
        sellVolume: 0,
        weightedBuyVolume: 0,
        weightedSellVolume: 0,

        recentVolume: 0,
        veryRecentVolume: 0,
        recentBuyVolume: 0,
        recentSellVolume: 0,

        trades: 0,
        buyTrades: 0,
        sellTrades: 0,

        wallets: new Set(),
        buyWallets: new Set(),
        sellWallets: new Set(),

        highConfidenceBuyWallets: new Set(),
        highConfidenceSellWallets: new Set(),

        whaleBuyWallets: new Set(),
        whaleSellWallets: new Set(),

        walletScoreTotal: 0,
        walletScoreCount: 0,

        avgPriceTotal: 0,
        maxTrade: 0,
        maxBuyTrade: 0,
        maxSellTrade: 0,

        ufc: isUfcMarket(trade.market),
      });
    }

    const item = markets.get(key);

    item.volume += value;
    item.weightedVolume += weightedValue;
    item.trades += 1;
    item.avgPriceTotal += price;
    item.maxTrade = Math.max(item.maxTrade, value);

    if (walletConfidence.score > 0) {
      item.walletScoreTotal += walletConfidence.score;
      item.walletScoreCount += 1;
    }

    if (timestamp >= recentWindow) item.recentVolume += value;
    if (timestamp >= veryRecentWindow) item.veryRecentVolume += value;

    if (trade.wallet) item.wallets.add(trade.wallet);

    if (side === "BUY") {
      item.buyVolume += value;
      item.weightedBuyVolume += weightedValue;
      item.buyTrades += 1;
      item.maxBuyTrade = Math.max(item.maxBuyTrade, value);

      if (timestamp >= recentWindow) item.recentBuyVolume += value;
      if (trade.wallet) item.buyWallets.add(trade.wallet);
      if (trade.wallet && value >= 10000) item.whaleBuyWallets.add(trade.wallet);
      if (trade.wallet && walletConfidence.score >= 70) {
        item.highConfidenceBuyWallets.add(trade.wallet);
      }
    }

    if (side === "SELL") {
      item.sellVolume += value;
      item.weightedSellVolume += weightedValue;
      item.sellTrades += 1;
      item.maxSellTrade = Math.max(item.maxSellTrade, value);

      if (timestamp >= recentWindow) item.recentSellVolume += value;
      if (trade.wallet) item.sellWallets.add(trade.wallet);
      if (trade.wallet && value >= 10000) item.whaleSellWallets.add(trade.wallet);
      if (trade.wallet && walletConfidence.score >= 70) {
        item.highConfidenceSellWallets.add(trade.wallet);
      }
    }
  }

  const studies = [];

  for (const item of markets.values()) {
    const avgPrice = item.avgPriceTotal / Math.max(item.trades, 1);

    const buyPressure = item.buyVolume / Math.max(item.volume, 1);
    const sellPressure = item.sellVolume / Math.max(item.volume, 1);

    const weightedBuyPressure =
      item.weightedBuyVolume / Math.max(item.weightedVolume, 1);

    const weightedSellPressure =
      item.weightedSellVolume / Math.max(item.weightedVolume, 1);

    const uniqueWallets = item.wallets.size;
    const buyWalletCount = item.buyWallets.size;
    const sellWalletCount = item.sellWallets.size;

    const whaleBuyCount = item.whaleBuyWallets.size;
    const whaleSellCount = item.whaleSellWallets.size;

    const highConfidenceBuyCount = item.highConfidenceBuyWallets.size;
    const highConfidenceSellCount = item.highConfidenceSellWallets.size;

    const avgWalletScore =
      item.walletScoreTotal / Math.max(item.walletScoreCount, 1);

    const recentShare = item.recentVolume / Math.max(item.volume, 1);
    const veryRecentShare = item.veryRecentVolume / Math.max(item.volume, 1);

    const recentBuyPressure =
      item.recentBuyVolume /
      Math.max(item.recentBuyVolume + item.recentSellVolume, 1);

    let score = 0;
    const reasons = [];
    const risks = [];
    const conflictWarnings = [];

    if (item.volume >= 50000) {
      score += 20;
      reasons.push("major total volume");
    } else if (item.volume >= 20000) {
      score += 16;
      reasons.push("strong total volume");
    } else if (item.volume >= 7500) {
      score += 11;
      reasons.push("solid total volume");
    } else if (item.volume >= 1500) {
      score += 7;
      reasons.push("early volume building");
    }

    if (item.weightedVolume >= item.volume * 1.25) {
      score += 10;
      reasons.push("wallet-quality adjusted volume is strong");
    }

    if (item.trades >= 100) {
      score += 14;
      reasons.push("very active trade count");
    } else if (item.trades >= 50) {
      score += 11;
      reasons.push("high trade count");
    } else if (item.trades >= 20) {
      score += 8;
      reasons.push("active trade flow");
    } else if (item.trades >= 8) {
      score += 4;
      reasons.push("developing trade flow");
    }

    if (uniqueWallets >= 30) {
      score += 14;
      reasons.push("broad wallet participation");
    } else if (uniqueWallets >= 15) {
      score += 10;
      reasons.push("multiple wallets confirming");
    } else if (uniqueWallets >= 5) {
      score += 6;
      reasons.push("wallet cluster forming");
    }

    if (weightedBuyPressure >= 0.8) {
      score += 22;
      reasons.push("dominant weighted buy pressure");
    } else if (weightedBuyPressure >= 0.65) {
      score += 15;
      reasons.push("positive weighted buy pressure");
    } else if (weightedBuyPressure <= 0.45) {
      risks.push("weak weighted buy pressure");
      score -= 10;
    }

    if (buyPressure >= 0.75) {
      score += 8;
      reasons.push("raw buy pressure confirms signal");
    }

    if (recentBuyPressure >= 0.75 && item.recentBuyVolume >= 1000) {
      score += 10;
      reasons.push("recent buy pressure improving");
    } else if (recentBuyPressure <= 0.4 && item.recentSellVolume >= 1000) {
      risks.push("recent sell pressure increasing");
      score -= 10;
    }

    if (highConfidenceBuyCount >= 3) {
      score += 15;
      reasons.push("multiple high-confidence wallets buying");
    } else if (highConfidenceBuyCount >= 1) {
      score += 8;
      reasons.push("high-confidence wallet buying");
    }

    if (highConfidenceSellCount >= 3) {
      risks.push("multiple high-confidence wallets selling against this side");
      conflictWarnings.push("quality-wallet opposition detected");
      score -= 18;
    } else if (highConfidenceSellCount >= 1) {
      risks.push("high-confidence wallet selling against this side");
      score -= 10;
    }

    if (weightedSellPressure >= 0.65) {
      risks.push("heavy weighted sell pressure");
      conflictWarnings.push("weighted seller pressure controls most volume");
      score -= 20;
    } else if (weightedSellPressure >= 0.5) {
      risks.push("meaningful weighted sell pressure");
      conflictWarnings.push("buy side has real opposition");
      score -= 10;
    }

    if (sellWalletCount > buyWalletCount && sellWalletCount >= 5) {
      risks.push("more unique wallets selling than buying");
      conflictWarnings.push("wallet count favors the opposing side");
      score -= 8;
    }

    if (whaleSellCount >= 2) {
      risks.push("multiple whale wallets selling against this side");
      conflictWarnings.push("opposing whale pressure detected");
      score -= 15;
    } else if (whaleSellCount === 1) {
      risks.push("one whale wallet selling against this side");
      score -= 8;
    }

    if (avgPrice <= 0.35 && weightedBuyPressure >= 0.6) {
      score += 15;
      reasons.push("underdog price with weighted buying support");
    } else if (avgPrice <= 0.2 && weightedBuyPressure >= 0.55) {
      score += 12;
      reasons.push("longshot price with possible value");
    } else if (avgPrice >= 0.8) {
      risks.push("expensive entry");
      score -= 8;
    }

    if (item.maxBuyTrade >= 25000) {
      score += 12;
      reasons.push("large buy-side conviction trade present");
    } else if (item.maxBuyTrade >= 10000) {
      score += 8;
      reasons.push("buy-side whale trade present");
    } else if (item.maxBuyTrade >= 2500) {
      score += 4;
      reasons.push("meaningful buy-side trade present");
    }

    if (item.maxSellTrade >= item.maxBuyTrade && item.maxSellTrade >= 10000) {
      risks.push("largest trade is against this side");
      conflictWarnings.push("largest observed trade is sell-side");
      score -= 10;
    }

    if (whaleBuyCount >= 3) {
      score += 12;
      reasons.push("multiple whale buyers involved");
    } else if (whaleBuyCount >= 1) {
      score += 6;
      reasons.push("whale buyer involved");
    }

    if (avgWalletScore >= 80) {
      score += 12;
      reasons.push("average wallet quality is high");
    } else if (avgWalletScore >= 65) {
      score += 7;
      reasons.push("average wallet quality is above baseline");
    }

    if (veryRecentShare >= 0.35) {
      score += 8;
      reasons.push("recent volume acceleration");
    } else if (recentShare >= 0.5) {
      score += 5;
      reasons.push("recent activity concentration");
    }

    if (item.ufc) {
      score += 5;
      reasons.push("UFC-specific market");
    }

    if (item.volume < 1000) risks.push("thin total volume");
    if (uniqueWallets < 4) risks.push("low wallet confirmation");
    if (item.trades < 8) risks.push("small trade sample");
    if (item.buyVolume < 500) risks.push("low buy-side dollar support");
    if (avgWalletScore < 20) risks.push("limited wallet quality data");

    score = Math.max(0, Math.min(score, 100));

    let viability = "Avoid";
    if (score >= 85) viability = "Strong";
    else if (score >= 70) viability = "Medium";
    else if (score >= 55) viability = "Speculative";

    if (score >= 55) {
      studies.push({
        market: item.market,
        slug: item.slug,
        outcome: item.outcome,
        side: "BUY",
        avgPrice,
        score,
        viability,

        volume: item.volume,
        weightedVolume: item.weightedVolume,
        buyVolume: item.buyVolume,
        sellVolume: item.sellVolume,

        trades: item.trades,
        uniqueWallets,
        buyWalletCount,
        sellWalletCount,

        whaleBuyCount,
        whaleSellCount,
        highConfidenceBuyCount,
        highConfidenceSellCount,

        buyPressure,
        sellPressure,
        weightedBuyPressure,
        weightedSellPressure,
        recentBuyPressure,
        recentShare,
        veryRecentShare,
        avgWalletScore,

        maxTrade: item.maxTrade,
        maxBuyTrade: item.maxBuyTrade,
        maxSellTrade: item.maxSellTrade,

        reasons,
        risks,
        conflictWarnings,
        ufc: item.ufc,
      });
    }
  }

  return studies.sort((a, b) => b.score - a.score).slice(0, 3);
}

function buildTradeStudyEmbed(study) {
  const logo = process.env.UFC_LOGO_URL;

  const embed = new EmbedBuilder()
    .setColor(study.ufc ? 0xd20a0a : 0x2563eb)
    .setTitle(study.ufc ? "RWTCH UFC Trade Study" : "RWTCH Trade Study")
    .setDescription(`${study.side} ${study.outcome}`)
    .addFields(
      { name: "Market", value: study.market.slice(0, 1024) },
      { name: "Observed Price", value: `${(study.avgPrice * 100).toFixed(2)} cents`, inline: true },
      { name: "Viability", value: study.viability, inline: true },
      { name: "Score", value: `${study.score}/100`, inline: true },
      {
        name: "Volume Studied",
        value: `$${study.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Weighted Volume",
        value: `$${study.weightedVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Avg Wallet Score",
        value: `${study.avgWalletScore.toFixed(1)}/100`,
        inline: true,
      },
      {
        name: "Buy Volume",
        value: `$${study.buyVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Sell Volume",
        value: `$${study.sellVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      { name: "Trades Studied", value: `${study.trades}`, inline: true },
      { name: "Unique Wallets", value: `${study.uniqueWallets}`, inline: true },
      { name: "Buy Wallets", value: `${study.buyWalletCount}`, inline: true },
      { name: "Sell Wallets", value: `${study.sellWalletCount}`, inline: true },
      { name: "High-Confidence Buyers", value: `${study.highConfidenceBuyCount}`, inline: true },
      { name: "High-Confidence Sellers", value: `${study.highConfidenceSellCount}`, inline: true },
      { name: "Whale Buyers", value: `${study.whaleBuyCount}`, inline: true },
      { name: "Whale Sellers", value: `${study.whaleSellCount}`, inline: true },
      { name: "Weighted Buy Pressure", value: `${(study.weightedBuyPressure * 100).toFixed(1)}%`, inline: true },
      { name: "Weighted Sell Pressure", value: `${(study.weightedSellPressure * 100).toFixed(1)}%`, inline: true },
      { name: "Recent Buy Pressure", value: `${(study.recentBuyPressure * 100).toFixed(1)}%`, inline: true },
      {
        name: "Largest Buy",
        value: `$${study.maxBuyTrade.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Largest Sell",
        value: `$${study.maxSellTrade.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Reasons",
        value: study.reasons.length ? study.reasons.join("; ").slice(0, 1024) : "none",
      },
      {
        name: "Risks",
        value: study.risks.length ? study.risks.join("; ").slice(0, 1024) : "none",
      },
      {
        name: "Conflict Warning",
        value: study.conflictWarnings.length
          ? study.conflictWarnings.join("; ").slice(0, 1024)
          : "none",
      }
    )
    .setFooter({ text: "RWTCH Analytical Trade Engine" })
    .setTimestamp();

  if (study.slug) {
    embed.setURL(`https://polymarket.com/event/${study.slug}`);
  }

  if (study.ufc && logo) {
    embed.setThumbnail(logo);
  }

  return embed;
}

module.exports = {
  analyzeBestTrades,
  buildTradeStudyEmbed,
  isUfcMarket,
};