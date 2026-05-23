const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");

function canUseItem(player, item) {
  if (!item.compatibleClasses) return true;
  if (item.compatibleClasses.includes("all")) return true;

  return item.compatibleClasses.includes(player.classId);
}

module.exports = async function shopCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();

  const requestedLevel = Number(args[0] || 1);

  const filteredItems = shopItems.filter(
    (item) =>
      Number(item.requiredLevel || 1) === requestedLevel &&
      canUseItem(player, item)
  );

  if (filteredItems.length === 0) {
    return message.reply(
      `❌ No items found for Level ${requestedLevel} for your class.`
    );
  }

  const itemsText = filteredItems
    .slice(0, 10)
    .map((item) => {
      const icon = item.emoji || "📦";

      return (
        `${icon} **${item.name}**\n` +
        `🏷️ ID: \`${item.id}\`\n` +
        `⭐ ${item.quality || "Common"} • ${item.type}\n` +
        `🔓 Required: Lv.${item.requiredLevel || 1}\n` +
        `🎭 Class: \`${(item.compatibleClasses || ["all"]).join(", ")}\`\n` +
        `💰 ${item.price} Gold\n` +
        `✨ ${item.description}`
      );
    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle(`🏪 SYXTH SHOP • LEVEL ${requestedLevel}`)
    .setDescription(
      `👤 Class: **${player.class || "Unknown"}**\n\n` +
        `${itemsText}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🛒 Buy Item:\n` +
        `\`!s buy <item_id> <quantity>\`\n\n` +
        `📖 Example:\n` +
        `\`!s buy hp_potion 5\`\n\n` +
        `🗂️ Available Shop Levels:\n` +
        `\`1 5 10 15 20 25 30 35 40 45 50 55 60 65 70 75 80 85 90\``
    )
    .setFooter({
      text: "Syxth MMORPG Shop",
    });

  return message.reply({ embeds: [embed] });
};