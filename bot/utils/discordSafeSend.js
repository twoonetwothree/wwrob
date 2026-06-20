async function safeSend(channel, payload, label = "Discord send") {
  if (!channel) return false;

  try {
    await Promise.race([
      channel.send(payload),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out`)), 8000)
      ),
    ]);

    return true;
  } catch (error) {
    console.error(`❌ ${label} failed:`, error.message);
    return false;
  }
}

module.exports = { safeSend };