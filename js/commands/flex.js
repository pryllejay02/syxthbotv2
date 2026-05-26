const { db } = require("../../firebase/firebase");
const tradeConfig = require("../data/tradeConfig");

function formatClass(classes = []) {
  return classes
    .map(
      (cls) =>
        cls.charAt(0).toUpperCase() +
        cls.slice(1)
    )
    .join(", ");
}

function formatStats(stats = {}) {
  return (
    `⚔️ ATK: ${stats.attack || 0} | ` +
    `🛡️ DEF: ${stats.defense || 0} | ` +
    `❤️ HP: ${stats.maxHp || 0}\n` +
    `💨 Dodge: ${stats.dodge || 0}% | ` +
    `💥 Crit: ${stats.crit || 0}%`
  );
}

module.exports = async function flexCommand(message, args = []) {
  const userId = message.author.id;
  const itemId = args[0];

  if (message.channel.id !== tradeConfig.tradeAreaChannelId) {
    return message.reply(
      `❌ You can only flex items inside <#${tradeConfig.tradeAreaChannelId}>.`
    );
  }

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID.\n\nExample: `!s flex <item_id>`"
    );
  }

  const playerRef = db.collection("players").doc(userId);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("❌ You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();
  const inventory = player.inventory || [];

  const item = inventory.find(
    (invItem) =>
      invItem.id.toLowerCase() === itemId.toLowerCase()
  );

  if (!item) {
    return message.reply("❌ You don’t have that item in your inventory.");
  }

  return message.channel.send(
    `💎 **ITEM FLEX** 💎\n\n` +
      `👤 **${player.username || message.author.username}** is showing an item:\n\n` +
      `${item.emoji || "📦"} ${item.qualityEmoji || ""} **${item.name || "Unknown Item"}** x${item.quantity || 1}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🏷️ Quality: **${item.quality || "Unknown"}**\n` +
      `🔓 Level: **Lv.${item.requiredLevel || 1}**\n` +
      `🎭 Class: **${formatClass(item.compatibleClasses || ["all"])}**\n\n` +
      `${formatStats(item.stats || {})}\n\n` +
      `🏷️ ID: \`${item.id}\`\n\n` +
      `Interested? Talk here, then use the private trade creation channel to start a secure trade.`
  );
};