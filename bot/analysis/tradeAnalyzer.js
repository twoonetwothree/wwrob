const { EmbedBuilder } = require("discord.js");

function isUfcMarket(market = "") {
  const text = String(market).toLowerCase();

  return (
    text.includes("ufc") ||
    text.includes("mma") ||
    text.includes("fight") ||
    text.includes("fighter") ||
    text.includes("knockout") ||
    text.includes("submission") ||
    text.includes("decision") ||
    text.includes("round ") ||
    text.includes("dana white")
  );
}

function analyzeBestTrades(trades, options = {}) {
  const markets = new Map();
  const onlyUfc = Boolean(options.onlyUfc);

  for (const trade of trades) {
    if (!trade.market || !trade.outcome || !trade.side) continue;

    if (onlyUfc && !isUfcMarket(trade.market)) continue;

    const value = Number(trade.value || trade.size * trade.price || 0);
    const price = Number(trade.price || 0);

    if (value < 10 || price <= 0 || price >= 1) continue;

    const key = `${trade.slug || trade.market}:${trade.outcome}`;

    if (!markets.has(key)) {
      markets.set(key, {
        market: trade.market,
        slug: trade.slug || "",
        outcome: trade.outcome,
        side: trade.side,
        volume: 0,
        trades: 0,
        wallets: new Set(),
        buyVolume: 0,
        sellVolume: 0,
        avgPriceTotal: 0,
        maxTrade: 0,
        ufc: isUfcMarket(trade.market),
      });
    }

    const item = markets.get(key);

    item.volume += value;
    item.trades += 1;
    item.avgPriceTotal += price;
    item.maxTrade = Math.max(item.maxTrade, value);

    if (trade.wallet) item.wallets.add(trade.wallet);

    if (String(trade.side).toUpperCase() === "BUY") {
      item.buyVolume += value;
    } else if (String(trade.side).toUpperCase() === "SELL") {
      item.sellVolume += value;
    }
  }

  const studies = [];

  for (const item of markets.values()) {
    const avgPrice = item.avgPriceTotal / Math.max(item.trades, 1);
    const buyPressure = item.buyVolume / Math.max(item.volume, 1);
    const uniqueWallets = item.wallets.size;

    let score = 0;
    const reasons = [];
    const risks = [];

    if (item.volume >= 10000) {
      score += 25;
      reasons.push("strong total volume");
    } else if (item.volume >= 5000) {
      score += 18;
      reasons.push("solid total volume");
    } else if (item.volume >= 1000) {
      score += 10;
      reasons.push("early volume building");
    }

    if (item.trades >= 50) {
      score += 20;
      reasons.push("high trade count");
    } else if (item.trades >= 20) {
      score += 14;
      reasons.push("active trade flow");
    } else if (item.trades >= 8) {
      score += 8;
      reasons.push("developing trade flow");
    }

    if (uniqueWallets >= 20) {
      score += 20;
      reasons.push("broad wallet participation");
    } else if (uniqueWallets >= 10) {
      score += 14;
      reasons.push("multiple wallets involved");
    } else if (uniqueWallets >= 4) {
      score += 7;
      reasons.push("small wallet cluster forming");
    }

    if (buyPressure >= 0.75) {
      score += 20;
      reasons.push("strong buy pressure");
    } else if (buyPressure >= 0.6) {
      score += 12;
      reasons.push("positive buy pressure");
    } else if (buyPressure <= 0.4) {
      risks.push("weak buy pressure");
    }

    if (avgPrice <= 0.35 && buyPressure >= 0.6) {
      score += 15;
      reasons.push("underdog odds with buying support");
    } else if (avgPrice >= 0.75) {
      risks.push("expensive entry price");
    }

    if (item.maxTrade >= 5000) {
      score += 10;
      reasons.push("large single trade present");
    } else if (item.maxTrade >= 1000) {
      score += 5;
      reasons.push("meaningful single trade present");
    }

    if (item.ufc) {
      score += 5;
      reasons.push("UFC market-specific signal");
    }

    if (item.volume < 500) risks.push("thin volume");
    if (uniqueWallets < 3) risks.push("low wallet confirmation");
    if (item.trades < 5) risks.push("low trade sample");

    let viability = "Avoid";
    if (score >= 80) viability = "Strong";
    else if (score >= 65) viability = "Medium";
    else if (score >= 50) viability = "Weak";

    if (score >= 50) {
      studies.push({
        market: item.market,
        slug: item.slug,
        outcome: item.outcome,
        side: "BUY",
        avgPrice,
        score: Math.min(score, 100),
        viability,
        volume: item.volume,
        trades: item.trades,
        uniqueWallets,
        buyPressure,
        maxTrade: item.maxTrade,
        reasons,
        risks,
        ufc: item.ufc,
      });
    }
  }

  return studies.sort((a, b) => b.score - a.score).slice(0, 3);
}

function buildTradeStudyEmbed(study) {
  const isUfc = Boolean(study.ufc);
  const logo = process.env.UFC_LOGO_URL;

  const embed = new EmbedBuilder()
    .setColor(isUfc ? 0xd20a0a : 0x2563eb)
    .setTitle(isUfc ? "RWTCH UFC Trade Study" : "RWTCH Trade Study")
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
      { name: "Trades Studied", value: `${study.trades}`, inline: true },
      { name: "Unique Wallets", value: `${study.uniqueWallets}`, inline: true },
      { name: "Buy Pressure", value: `${(study.buyPressure * 100).toFixed(1)}%`, inline: true },
      {
        name: "Largest Trade",
        value: `$${study.maxTrade.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Reasons",
        value: study.reasons.length ? study.reasons.join("; ").slice(0, 1024) : "none",
      },
      {
        name: "Risks",
        value: study.risks.length ? study.risks.join("; ").slice(0, 1024) : "none",
      }
    )
    .setFooter({ text: "RWTCH Analytical Trade Engine" })
    .setTimestamp();

  if (study.slug) {
    embed.setURL(`https://polymarket.com/event/${study.slug}`);
  }

  if (isUfc && logo) {
    embed.setThumbnail(logo);
  }

  return embed;
}

module.exports = {
  analyzeBestTrades,
  buildTradeStudyEmbed,
  isUfcMarket,
};