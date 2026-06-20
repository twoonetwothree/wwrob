function getWalletGrade(wallet, score) {
  const volume = Number(wallet.total_volume || 0);
  const trades = Number(wallet.trade_count || 0);
  const pnl = Number(wallet.best_estimated_pl || 0);

  if (score >= 90 || (volume >= 500000 && trades >= 25)) {
    return {
      grade: "S",
      label: "Elite Smart Wallet",
      emoji: "🎯",
      channelType: "smart",
    };
  }

  if (score >= 80 || (volume >= 250000 && trades >= 15)) {
    return {
      grade: "A",
      label: "Top Trader",
      emoji: "🏆",
      channelType: "top",
    };
  }

  if (score >= 70 || volume >= 100000) {
    return {
      grade: "B",
      label: "Repeat Whale",
      emoji: "🐋",
      channelType: "whale",
    };
  }

  if (trades <= 3 && volume >= 2500) {
    return {
      grade: "Fresh",
      label: "Fresh Wallet",
      emoji: "🆕",
      channelType: "fresh",
    };
  }

  return {
    grade: "C",
    label: "Tracked Wallet",
    emoji: "📊",
    channelType: "scanner",
  };
}

module.exports = { getWalletGrade };