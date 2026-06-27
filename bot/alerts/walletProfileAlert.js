const { EmbedBuilder } = require("discord.js");
const db = require("../db/database");
const { scoreWallet } = require("../wallets/walletScoring");
const { getWalletGrade } = require("../wallets/walletGrade");

function shortWallet(address = "") {
  if (!address || address.length < 12) return address || "unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function buildWalletProfileEmbed(wallet) {
  const score = scoreWallet(wallet);
  const grade = getWalletGrade(wallet, score);

  const volume = Number(wallet.total_volume || 0);
  const trades = Number(wallet.trade_count || 0);
  const avgTrade = trades > 0 ? volume / trades : 0;
  const bestPL = Number(wallet.best_estimated_pl || 0);

  return new EmbedBuilder()
    .setColor(score >= 85 ? 0x22c55e : score >= 70 ? 0x3b82f6 : 0xf59e0b)
    .setTitle("RWTCH Wallet Intelligence")
    .setDescription(`Wallet: \`${shortWallet(wallet.address)}\``)
    .addFields(
      { name: "Grade", value: `${grade.grade} - ${grade.label}`, inline: true },
      { name: "Confidence", value: `${score}/100`, inline: true },
      {
        name: "Observed Volume",
        value: `$${volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      { name: "Trades Seen", value: `${trades}`, inline: true },
      {
        name: "Average Trade",
        value: `$${avgTrade.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        inline: true,
      },
      { name: "Best Estimated P/L", value: `${bestPL.toFixed(2)}%`, inline: true },
      { name: "Full Wallet", value: `\`${wallet.address}\`` },
      { name: "Notes", value: wallet.notes || "No notes yet." }
    )
    .setFooter({ text: "RWTCH Wallet Confidence Engine" })
    .setTimestamp();
}

async function sendWalletProfileReport(channel) {
  if (!channel) return;

  const wallets = db
    .prepare(`
      SELECT *
      FROM wallets
      WHERE trade_count >= 3
      ORDER BY total_volume DESC
      LIMIT 30
    `)
    .all();

  const ranked = wallets
    .map((wallet) => ({ wallet, score: scoreWallet(wallet) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.wallet.total_volume || 0) - Number(a.wallet.total_volume || 0);
    })
    .slice(0, 5);

  for (const item of ranked) {
    await channel.send({ embeds: [buildWalletProfileEmbed(item.wallet)] });
  }
}

module.exports = {
  sendWalletProfileReport,
};