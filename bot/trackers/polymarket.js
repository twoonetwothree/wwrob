const axios = require("axios");

const GAMMA_BASE = "https://gamma-api.polymarket.com";

async function fetchPolymarketMarkets(limit = 25) {
  const url = `${GAMMA_BASE}/markets`;

  const response = await axios.get(url, {
    params: {
      active: true,
      closed: false,
      limit,
      order: "volume",
      ascending: false,
    },
  });

  return response.data.map((market) => {
    let outcomes = [];
    let prices = [];

    try {
      outcomes = JSON.parse(market.outcomes || "[]");
      prices = JSON.parse(market.outcomePrices || "[]");
    } catch {
      outcomes = [];
      prices = [];
    }

    return {
      id: market.id,
      question: market.question || "Unknown market",
      slug: market.slug,
      url: `https://polymarket.com/market/${market.slug}`,
      volume: Number(market.volume || 0),
      liquidity: Number(market.liquidity || 0),
      outcomes,
      prices: prices.map(Number),
      yesPrice: Number(prices[0] || 0),
      noPrice: Number(prices[1] || 0),
      category: market.category || "Unknown",
      enableOrderBook: market.enableOrderBook,
    };
  });
}

module.exports = { fetchPolymarketMarkets };