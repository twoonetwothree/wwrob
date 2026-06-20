function scoreWallet(wallet) {
  let score = 0;

  if (wallet.total_volume >= 100000) score += 40;
  else if (wallet.total_volume >= 50000) score += 25;
  else if (wallet.total_volume >= 10000) score += 15;

  if (wallet.trade_count >= 25) score += 25;
  else if (wallet.trade_count >= 10) score += 15;
  else if (wallet.trade_count <= 3 && wallet.total_volume >= 10000) score += 25;

  if (wallet.best_estimated_pl >= 25) score += 25;
  else if (wallet.best_estimated_pl >= 15) score += 15;
  else if (wallet.best_estimated_pl >= 8) score += 8;

  return Math.min(score, 100);
}

module.exports = { scoreWallet };