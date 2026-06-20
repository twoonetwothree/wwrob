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
      0,
      "Fresh wallet detected by RWTCH."
    );
  } else {
    db.prepare(`
      UPDATE wallets
      SET last_seen = ?,
          trade_count = trade_count + 1,
          total_volume = total_volume + ?
      WHERE address = ?
    `).run(now, volume, trade.wallet);
  }

  return db
    .prepare("SELECT * FROM wallets WHERE address = ?")
    .get(trade.wallet);
}

module.exports = { saveTrade };