const fs = require("fs");

const STATS_PATH = "data/stats.json";

function ensureStatsFile() {
  if (!fs.existsSync("data")) fs.mkdirSync("data");

  if (!fs.existsSync(STATS_PATH)) {
    fs.writeFileSync(
      STATS_PATH,
      JSON.stringify(
        {
          startedAt: Date.now(),
          tradesProcessed: 0,
          walletsTracked: 0,
          alertsPosted: 0,
          freshWalletAlerts: 0,
          repeatWalletAlerts: 0,
          lastUpdated: Date.now(),
        },
        null,
        2
      )
    );
  }
}

function readStats() {
  ensureStatsFile();
  return JSON.parse(fs.readFileSync(STATS_PATH, "utf8"));
}

function updateStats(updates = {}) {
  const stats = readStats();

  const updated = {
    ...stats,
    ...updates,
    tradesProcessed: stats.tradesProcessed + (updates.tradesProcessed || 0),
    alertsPosted: stats.alertsPosted + (updates.alertsPosted || 0),
    freshWalletAlerts: stats.freshWalletAlerts + (updates.freshWalletAlerts || 0),
    repeatWalletAlerts: stats.repeatWalletAlerts + (updates.repeatWalletAlerts || 0),
    lastUpdated: Date.now(),
  };

  fs.writeFileSync(STATS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

module.exports = { readStats, updateStats };