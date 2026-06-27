const { EmbedBuilder } = require("discord.js");

function getAlertColor(score, tradeValue, wallet) {
  if (tradeValue >= 10000) return 0xff3b30;
  if (score >= 85 || tradeValue >= 5000) return 0xff9500;
  if (wallet.trade_count <= 3 && tradeValue >= 250) return 0x34c759;
  return 0x3b82f6;
}

function getWalletLabel(wallet, tradeValue) {
  if (tradeValue >= 10000) return "Whale Trade";
  if (wallet.trade_count <= 3 && tradeValue >= 250) return "Fresh Wallet";
  if (wallet.total_volume >= 100000) return "Top Trader";
  if (wallet.trade_count >= 10) return "Smart Wallet";
  return "Qualified Trader";
}

async function sendWalletAlert(channel, wallet, trade, score, grade = {}) {
  if (!channel) return;

  const tradeValue = Number(trade.value || trade.size * trade.price || 0);
  const label = getWalletLabel(wallet, tradeValue);
  const color = getAlertColor(score, tradeValue, wallet);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`RWTCH ${label}`)
    .setDescription(
      `**${trade.side} ${trade.outcome}** in [${trade.market}](https://polymarket.com/event/${trade.slug || ""})`
    )
    .addFields(
      {
        name: "Trade Size",
        value: `$${tradeValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "Price",
        value: `${(Number(trade.price || 0) * 100).toFixed(2)} cents`,
        inline: true,
      },
      {
        name: "Score",
        value: `${score}/100`,
        inline: true,
      },
      {
        name: "Wallet Type",
        value: grade.label || label,
        inline: true,
      },
      {
        name: "Observed Volume",
        value: `$${Number(wallet.total_volume || 0).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}`,
        inline: true,
      },
      {
        name: "Observed Trades",
        value: `${wallet.trade_count || 0}`,
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
    .setFooter({ text: "RWTCH Polymarket Intelligence" })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

module.exports = { sendWalletAlert };