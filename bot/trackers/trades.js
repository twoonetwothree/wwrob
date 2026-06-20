const axios = require("axios");

function buildTradeId(t) {
  return [
    t.transactionHash,
    t.proxyWallet,
    t.conditionId || t.market || t.slug,
    t.outcome,
    t.side,
    t.size,
    t.price,
    t.timestamp,
  ].join("-");
}

async function fetchRecentTrades(limit = 3000) {
  const all = [];
  const pageSize = 500;

  for (let offset = 0; offset < limit; offset += pageSize) {
    const res = await axios.get("https://data-api.polymarket.com/trades", {
      params: {
        limit: pageSize,
        offset,
        takerOnly: true,
      },
      timeout: 15000,
    });

    if (!Array.isArray(res.data) || res.data.length === 0) break;

    all.push(...res.data);

    if (res.data.length < pageSize) break;
  }

  const mapped = all.map((t) => {
    const size = Number(t.size || 0);
    const price = Number(t.price || 0);

    return {
      id: buildTradeId(t),
      wallet: t.proxyWallet,
      txHash: t.transactionHash,
      market: t.title || "Unknown Market",
      slug: t.slug,
      outcome: t.outcome || "UNKNOWN",
      side: t.side || "UNKNOWN",
      size,
      price,
      value: size * price,
      timestamp: Number(t.timestamp || Math.floor(Date.now() / 1000)),
      name: t.name || t.pseudonym || "Unknown Trader",
    };
  });

  mapped.sort((a, b) => a.timestamp - b.timestamp);

  return mapped;
}

module.exports = { fetchRecentTrades };