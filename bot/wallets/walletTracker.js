const db = require("../db/database");

function normalizeTradeId(trade) {
  return trade.id || [
    trade.txHash,
    trade.wallet,
    trade.market,
    trade.outcome,
    trade.side,
    trade.size,
    trade.price,
    trade.timestamp,
  ].join("-");
}

function estimateTradePL(trade) {
  const price = Number(trade.price || 0);

  if (!price || price <= 0) return 0;

  if (trade.side === "BUY") {
    return ((1 - price) / price) * 100;
  }

  if (trade.side === "SELL") {
    return (price / Math.max(1 - price, 0.01)) * 100;
  }

  return 0;
}

function buildWalletNote(wallet, estimatedPL) {
  const volume = Number(wallet.total_volume || 0);
  const trades = Number(wallet.trade_count || 0);

  if (estimatedPL >= 50 && trades <= 5) {
    return "Fresh wallet with strong estimated upside.";
  }

  if (volume >= 100000 && trades >= 10) {
    return "High-volume repeat trader.";
  }

  if (volume >= 50000) {
    return "Meaningful wallet volume detected.";
  }

  return wallet.notes || "Wallet tracked by RWTCH.";
}

function saveTrade(trade) {
  const tradeId = normalizeTradeId(trade);

  const existing = db
    .prepare("SELECT tx_hash FROM trades WHERE tx_hash = ?")
    .get(tradeId);

  if (existing) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const volume = Number(trade.size || 0) * Number(trade.price || 0);
  const estimatedPL = estimateTradePL(trade);

  db.prepare(`
    INSERT OR IGNORE INTO trades (
      tx_hash, wallet, market, outcome, side, size, price, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tradeId,
    trade.wallet,
    trade.market,
    trade.outcome,
    trade.side,
    trade.size,
    trade.price,
    trade.timestamp
  );

  const wallet = db
    .prepare("SELECT * FROM wallets WHERE address = ?")
    .get(trade.wallet);

  if (!wallet) {
    db.prepare(`
      INSERT INTO wallets (
        address,
        first_seen,
        last_seen,
        trade_count,
        total_volume,
        best_estimated_pl,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      trade.wallet,
      now,
      now,
      1,
      volume,
      estimatedPL,
      buildWalletNote({ total_volume: volume, trade_count: 1, notes: "" }, estimatedPL)
    );
  } else {
    const bestPL = Math.max(Number(wallet.best_estimated_pl || 0), estimatedPL);
    const updatedWallet = {
      ...wallet,
      total_volume: Number(wallet.total_volume || 0) + volume,
      trade_count: Number(wallet.trade_count || 0) + 1,
    };

    db.prepare(`
      UPDATE wallets
      SET last_seen = ?,
          trade_count = trade_count + 1,
          total_volume = total_volume + ?,
          best_estimated_pl = ?,
          notes = ?
      WHERE address = ?
    `).run(
      now,
      volume,
      bestPL,
      buildWalletNote(updatedWallet, bestPL),
      trade.wallet
    );
  }

  return db
    .prepare("SELECT * FROM wallets WHERE address = ?")
    .get(trade.wallet);
}

module.exports = { saveTrade };