const queue = [];
let isProcessing = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutPromise(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Discord send timed out")), ms)
    ),
  ]);
}

function getQueueSize() {
  return queue.length;
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift();

    try {
      await timeoutPromise(job(), 10000);
    } catch (error) {
      console.error("❌ Queue job failed:", error.message);
    }

    await sleep(1500);
  }

  isProcessing = false;
}

function enqueueSend(job) {
  if (queue.length > 50) {
    queue.splice(0, queue.length - 50);
    console.log("⚠️ Queue trimmed.");
  }

  queue.push(job);
  processQueue();
}

setInterval(() => {
  if (isProcessing && queue.length === 0) {
    isProcessing = false;
  }
}, 30000);

module.exports = { enqueueSend, getQueueSize };