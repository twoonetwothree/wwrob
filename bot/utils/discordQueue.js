const queue = [];
let processing = false;
let currentStartedAt = 0;

const SEND_TIMEOUT_MS = 8000;
const SEND_DELAY_MS = 1500;
const MAX_QUEUE_SIZE = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), SEND_TIMEOUT_MS)
    ),
  ]);
}

function getQueueSize() {
  return queue.length;
}

function enqueueDiscord(job, label = "discord job") {
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift();
  }

  queue.push({ job, label });
}

async function processQueue() {
  if (processing) return;
  if (queue.length === 0) return;

  processing = true;
  currentStartedAt = Date.now();

  const item = queue.shift();

  try {
    await withTimeout(item.job(), item.label);
  } catch (error) {
    console.error(`Discord queue failed: ${item.label}: ${error.message}`);
  } finally {
    await sleep(SEND_DELAY_MS);
    processing = false;
    currentStartedAt = 0;
  }
}

setInterval(processQueue, 500);

setInterval(() => {
  if (processing && Date.now() - currentStartedAt > 15000) {
    console.error("Discord queue watchdog reset.");
    processing = false;
    currentStartedAt = 0;
  }
}, 5000);

module.exports = {
  enqueueDiscord,
  getQueueSize,
};