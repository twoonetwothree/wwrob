const { EmbedBuilder } = require("discord.js");

function getMarketEmoji(market = "") {
  const text = market.toLowerCase();

  if (text.includes("nba") || text.includes("nfl") || text.includes("mlb") || text.includes("tennis") || text.includes("ufc")) return "🏀";
  if (text.includes("trump") || text.includes("election") || text.includes("president")) return "🏛️";
  if (text.includes("bitcoin") || text.includes("btc") || text.includes("ethereum") || text.includes("crypto")) return "₿";
  if (text.includes("fed") || text.includes("rate") || text.includes("inflation")) return "🏦";
  if (text.includes("war") || text.includes("ukraine") || text.includes("israel")) return "🌍";
  if (text.includes("weather") || text.includes("hurricane")) return "🌪️";

  return "📈";
}

function getAlertColor(score, tradeValue, wallet) {
  if (score >= 85 || tradeValue >= 50000) return 0xff3b30; // red
  if (score >= 70 || tradeValue >= 25000) return 0xff9500; // orange
  if (wallet.trade_count <= 3 && tradeValue >= 10000) return 0x34c759; // green
  return 0x3b82f6; // blue
}

function getWalletLabel(wallet, tradeValue) {
  if (wallet.trade_count <= 3 && tradeValue >= 10000) return "Fresh High-Value Wallet";
  if (wallet.total_volume >= 100000) return "Repeat Whale";
  if (tradeValue >= 50000) return "Large Single Trade";
  return "Qualified Trader";
}

async function sendWalletAlert(channel, wallet, trade, score) {
  const tradeValue = trade.size * trade.price;
  const emoji = getMarketEmoji(trade.market);
  const label = getWalletLabel(wallet, tradeValue);
  const color = getAlertColor(score, tradeValue, wallet);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} RWTCH Trader Alert`)
    .setDescription(
      `**${trade.side} "${trade.outcome}"** in [${trade.market}](https://polymarket.com/event/${trade.slug || ""})`
    )
    .addFields(
      {
        name: "Size",
        value: `$${tradeValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Price",
        value: `${(trade.price * 100).toFixed(2)}¢`,
        inline: true,
      },
      {
        name: "RWTCH Score",
        value: `${score}/100`,
        inline: true,
      },
      {
        name: "Trader Type",
        value: label,
        inline: true,
      },
      {
        name: "Observed Volume",
        value: `$${wallet.total_volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Observed Trades",
        value: `${wallet.trade_count}`,
        inline: true,
      },
      {
        name: "Trader",
        value: `\`${wallet.address}\``,
      },
      {
        name: "Notes",
        value: wallet.notes || "Tracking wallet behavior.",
      }
    )
    .setFooter({ text: "RWTCH • Polymarket Intelligence" })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

module.exports = { sendWalletAlert };