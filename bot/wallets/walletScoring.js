function scoreWallet(wallet) {
  let score = 0;

  const volume = Number(wallet.total_volume || 0);
  const trades = Number(wallet.trade_count || 0);

  if (volume >= 500000) score += 50;
  else if (volume >= 250000) score += 40;
  else if (volume >= 100000) score += 30;
  else if (volume >= 50000) score += 20;
  else if (volume >= 10000) score += 10;

  if (trades >= 100) score += 40;
  else if (trades >= 50) score += 30;
  else if (trades >= 25) score += 20;
  else if (trades >= 10) score += 10;

  const avgTradeSize =
    trades > 0 ? volume / trades : 0;

  if (avgTradeSize >= 5000) score += 10;
  else if (avgTradeSize >= 2000) score += 5;

  return Math.min(score, 100);
}

module.exports = { scoreWallet };