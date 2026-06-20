const Database = require("better-sqlite3");

const db = new Database("data/robwhalewatch.db");

db.exec(`
CREATE TABLE IF NOT EXISTS wallets (
  address TEXT PRIMARY KEY,
  first_seen INTEGER,
  last_seen INTEGER,
  trade_count INTEGER DEFAULT 0,
  total_volume REAL DEFAULT 0,
  best_estimated_pl REAL DEFAULT 0,
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS trades (
  tx_hash TEXT PRIMARY KEY,
  wallet TEXT,
  market TEXT,
  outcome TEXT,
  side TEXT,
  size REAL,
  price REAL,
  timestamp INTEGER
);
`);

module.exports = db;