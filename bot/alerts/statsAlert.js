const { EmbedBuilder } = require("discord.js");
const { readStats } = require("../logs/statsLogger");

function formatRuntime(startedAt) {
  const ms = Date.now() - startedAt;
  const hours = Math.floor(ms / 1000 / 60 / 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  return `${hours}h ${minutes}m`;
}

async function sendStatsAlert(channel) {
  const stats = readStats();

  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle("📊 RWTCH Statistics")
    .addFields(
      { name: "Trades Processed", value: `${stats.tradesProcessed}`, inline: true },
      { name: "Alerts Posted", value: `${stats.alertsPosted}`, inline: true },
      { name: "Runtime", value: formatRuntime(stats.startedAt), inline: true },
      { name: "Fresh Wallet Alerts", value: `${stats.freshWalletAlerts}`, inline: true },
      { name: "Repeat Wallet Alerts", value: `${stats.repeatWalletAlerts}`, inline: true }
    )
    .setFooter({ text: "RWTCH • Live Polymarket Monitor" })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

module.exports = { sendStatsAlert };