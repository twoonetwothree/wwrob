require("dotenv").config();

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { runScanner } = require("./bot/scanners/scanner");
const { sendStatsAlert } = require("./bot/alerts/statsAlert");
const { startLiveTrades } = require("./bot/trackers/liveTrades");
const { safeSend } = require("./bot/utils/discordSafeSend");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

let channels = {};
let scannerRunning = false;

let liveEvents = 0;
let latestMover = null;
let lastMoverPostedAt = 0;

async function loadChannels() {
  channels = {
    whale: await client.channels.fetch(process.env.WHALE_ALERT_CHANNEL_ID),
    scanner: await client.channels.fetch(process.env.MARKET_SCANNER_CHANNEL_ID),
    preAlert: await client.channels.fetch(process.env.PRE_ALERT_CHANNEL_ID),
    status: await client.channels.fetch(process.env.BOT_STATUS_CHANNEL_ID),
    top: await client.channels.fetch(process.env.TOP_TRADERS_CHANNEL_ID),
    fresh: await client.channels.fetch(process.env.FRESH_WALLETS_CHANNEL_ID),
    smart: await client.channels.fetch(process.env.SMART_WALLET_CHANNEL_ID),
    coordinated: await client.channels.fetch(process.env.COORDINATED_TRADES_CHANNEL_ID),
    movers: await client.channels.fetch(process.env.MARKET_MOVERS_CHANNEL_ID),
    profiles: await client.channels.fetch(process.env.WALLET_PROFILES_CHANNEL_ID),
  };
}

async function safeRunScanner() {
  if (scannerRunning) {
    console.log("⏳ Scanner already running. Skipping.");
    return;
  }

  scannerRunning = true;

  try {
    await runScanner(channels);
  } catch (error) {
    console.error("🔥 Scanner failed:", error.message);
    await safeSend(channels.status, `🔥 Scanner failed: ${error.message}`, "scanner error");
  } finally {
    scannerRunning = false;
  }
}

async function postLatestMover() {
  if (!latestMover) return;

  const now = Date.now();
  if (now - lastMoverPostedAt < 120000) return;

  const msg = latestMover;

  if (!msg.assetId || !msg.price || msg.price <= 0) return;
  if (msg.eventType === "book") return;

  lastMoverPostedAt = now;

  const embed = new EmbedBuilder()
    .setColor(0x06b6d4)
    .setTitle("📈 RWTCH Market Mover")
    .addFields(
      { name: "Event", value: `${msg.eventType}`, inline: true },
      { name: "Price", value: `${msg.price}`, inline: true },
      { name: "Asset", value: `\`${String(msg.assetId).slice(0, 28)}...\`` }
    )
    .setFooter({ text: "RWTCH • WebSocket Market Engine" })
    .setTimestamp();

  await safeSend(channels.movers, { embeds: [embed] }, "market mover");
}

client.once("ready", async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  await loadChannels();

  await safeSend(
    channels.status,
    "✅ RWTCH online. Live trade scanner + WebSocket market engine active.",
    "startup"
  );

  startLiveTrades(
    async (msg) => {
      liveEvents++;
      latestMover = msg;
    },
    async (statusMsg) => {
      console.log(statusMsg);
    }
  );

  await safeRunScanner();

  setInterval(safeRunScanner, 10000);
  setInterval(postLatestMover, 15000);

  setInterval(async () => {
    console.log(`💓 Heartbeat | liveEvents=${liveEvents}`);

    await safeSend(
      channels.status,
      `💓 RWTCH heartbeat\nLive WebSocket events: ${liveEvents}`,
      "heartbeat"
    );
  }, 60 * 1000);

  setInterval(async () => {
    try {
      await sendStatsAlert(channels.status);
    } catch (error) {
      console.error("Stats alert failed:", error.message);
    }
  }, 3600000);
});

client.login(process.env.DISCORD_TOKEN);