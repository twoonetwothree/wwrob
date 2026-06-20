const WebSocket = require("ws");
const { discoverActiveMarketAssets } = require("../markets/marketDiscovery");

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

let ws = null;
let connected = false;
let reconnectTimer = null;
let lastMessageAt = 0;
let subscribedAssets = [];

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function normalizeLiveMessage(msg) {
  const eventType = msg.event_type || msg.type;

  return {
    raw: msg,
    eventType,
    assetId: msg.asset_id || msg.assetId || msg.token_id || msg.asset,
    price: Number(msg.price || msg.last_trade_price || msg.best_bid || msg.best_ask || 0),
    size: Number(msg.size || msg.amount || 0),
    side: msg.side || "UNKNOWN",
    timestamp: Number(msg.timestamp || Math.floor(Date.now() / 1000)),
  };
}

async function subscribeToAssets() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const assets = await discoverActiveMarketAssets(100);
  const tokenIds = [...new Set(assets.map((a) => a.tokenId))].slice(0, 200);

  subscribedAssets = tokenIds;

  const chunks = chunkArray(tokenIds, 50);

  for (const chunk of chunks) {
    ws.send(
      JSON.stringify({
        assets_ids: chunk,
        type: "market",
      })
    );
  }

  console.log(`✅ WebSocket subscribed to ${tokenIds.length} assets.`);
}

function startLiveTrades(onLiveEvent, onStatus) {
  function reconnect() {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 5000);
  }

  function connect() {
    if (ws) {
      try {
        ws.removeAllListeners();
        ws.close();
      } catch {}
    }

    ws = new WebSocket(WS_URL);

    ws.on("open", async () => {
      connected = true;
      lastMessageAt = Date.now();

      console.log("✅ RWTCH WebSocket connected.");

      if (onStatus) {
        await onStatus("✅ RWTCH WebSocket connected.");
      }

      try {
        await subscribeToAssets();
      } catch (error) {
        console.error("Subscribe error:", error.message);
      }
    });

    ws.on("message", async (raw) => {
      lastMessageAt = Date.now();

      const text = raw.toString();

      if (!text.startsWith("{") && !text.startsWith("[")) return;

      try {
        const parsed = JSON.parse(text);
        const messages = Array.isArray(parsed) ? parsed : [parsed];

        for (const msg of messages) {
          const normalized = normalizeLiveMessage(msg);

          if (
            normalized.eventType === "price_change" ||
            normalized.eventType === "last_trade_price" ||
            normalized.eventType === "best_bid_ask"
          ) {
            await onLiveEvent(normalized);
          }
        }
      } catch (error) {
        console.error("WebSocket parse error:", error.message);
      }
    });

    ws.on("close", async () => {
      connected = false;
      console.log("⚠️ WebSocket closed. Reconnecting...");
      if (onStatus) await onStatus("⚠️ RWTCH WebSocket closed. Reconnecting.");
      reconnect();
    });

    ws.on("error", async (error) => {
      connected = false;
      console.error("WebSocket error:", error.message);
      if (onStatus) await onStatus(`❌ WebSocket error: ${error.message}`);
      reconnect();
    });
  }

  connect();

  setInterval(async () => {
    if (!connected || Date.now() - lastMessageAt > 60000) {
      console.log("⚠️ WebSocket heartbeat stale. Reconnecting.");
      if (onStatus) await onStatus("⚠️ WebSocket heartbeat stale. Reconnecting.");
      connected = false;
      reconnect();
      return;
    }

    try {
      await subscribeToAssets();
    } catch (error) {
      console.error("Resubscribe failed:", error.message);
    }
  }, 60000);
}

function isLiveConnected() {
  return connected;
}

function getSubscribedAssetCount() {
  return subscribedAssets.length;
}

module.exports = {
  startLiveTrades,
  isLiveConnected,
  getSubscribedAssetCount,
};