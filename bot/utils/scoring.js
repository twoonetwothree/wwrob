function scoreMarket(market) {
  let score = 0;

  if (market.volume >= 1000000) score += 25;
  else if (market.volume >= 500000) score += 18;
  else if (market.volume >= 100000) score += 10;

  if (market.liquidity >= 100000) score += 25;
  else if (market.liquidity >= 50000) score += 18;
  else if (market.liquidity >= 10000) score += 10;

  const priceDistance = Math.abs(0.5 - market.yesPrice);

  if (priceDistance <= 0.05) score += 20;
  else if (priceDistance <= 0.15) score += 12;
  else if (priceDistance <= 0.25) score += 6;

  if (market.enableOrderBook) score += 15;

  return Math.min(score, 100);
}

module.exports = { scoreMarket };