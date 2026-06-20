const { EmbedBuilder } = require("discord.js");

async function sendStatus(channel, message) {
  const embed = new EmbedBuilder()
    .setTitle("rwtch Status")
    .setDescription(message)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

module.exports = { sendStatus };