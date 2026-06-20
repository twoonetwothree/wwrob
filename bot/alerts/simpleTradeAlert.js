async function sendSimpleTradeAlert(channel, wallet, trade, score, grade) {
  const tradeValue = trade.size * trade.price;

  const msg =
    `${grade.emoji} **${trade.side} ${trade.outcome}** | ` +
    `$${tradeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} | ` +
    `${(trade.price * 100).toFixed(1)}¢ | ` +
    `Score: ${score}/100 | ` +
    `\`${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}\`\n` +
    `${trade.market}`;

  await channel.send(msg);
}

module.exports = { sendSimpleTradeAlert };