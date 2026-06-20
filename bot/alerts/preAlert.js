const { EmbedBuilder } = require("discord.js");

async function sendPreAlert(channel, market, score) {
  const embed = new EmbedBuilder()
    .setTitle("⚠️ Polymarket Pre-Alert")
    .setDescription("A market is showing strong watchlist conditions.")
    .addFields(
      { name: "Market", value: market.question },
      { name: "YES", value: `${(market.yesPrice * 100).toFixed(1)}%`, inline: true },
      { name: "NO", value: `${(market.noPrice * 100).toFixed(1)}%`, inline: true },
      { name: "Volume", value: `$${market.volume.toLocaleString()}`, inline: true },
      { name: "Liquidity", value: `$${market.liquidity.toLocaleString()}`, inline: true },
      { name: "Signal Score", value: `${score}/100`, inline: true },
      { name: "Market Link", value: market.url }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

module.exports = { sendPreAlert };