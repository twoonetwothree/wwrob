const axios = require("axios");

const GAMMA_URL = "https://gamma-api.polymarket.com/markets";

async function discoverActiveMarketAssets(limit = 50) {
  const res = await axios.get(GAMMA_URL, {
    params: {
      active: true,
      closed: false,
      limit,
      order: "volume",
      ascending: false,
    },
    timeout: 15000,
  });

  const assets = [];

  for (const market of res.data) {
    let tokenIds = [];

    try {
      tokenIds = JSON.parse(market.clobTokenIds || "[]");
    } catch {
      tokenIds = [];
    }

    for (const tokenId of tokenIds) {
      if (!tokenId) continue;

      assets.push({
        tokenId,
        marketId: market.id,
        question: market.question || "Unknown market",
        slug: market.slug,
        volume: Number(market.volume || 0),
        liquidity: Number(market.liquidity || 0),
      });
    }
  }

  console.log(`🔎 Discovered ${assets.length} active market asset IDs.`);
  return assets;
}

module.exports = { discoverActiveMarketAssets };