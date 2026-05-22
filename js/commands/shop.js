const { EmbedBuilder } = require("discord.js");
const shopItems = require("../data/shopItems");

module.exports = async function shopCommand(message, args = []) {
  // DEFAULT SHOP LEVEL = 1
  const requestedLevel = Number(args[0] || 1);

  const filteredItems = shopItems.filter(
    (item) => Number(item.requiredLevel || 1) === requestedLevel
  );

  if (filteredItems.length === 0) {
    return message.reply(`❌ No items found for Level ${requestedLevel}.`);
  }

  const itemsText = filteredItems
    .slice(0, 6)
    .map((item) => {
      const icon = item.emoji || "📦";

      return (
        `${icon} **${item.name}**\n` +
        `🏷️ ID: \`${item.id}\`\n` +
        `⭐ ${item.quality || "Common"} • ${item.type}\n` +
        `🔓 Required: Lv.${item.requiredLevel || 1}\n` +
        `💰 ${item.price} Gold\n` +
        `✨ ${item.description}`
      );
    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle(`🏪 SYXTH SHOP • LEVEL ${requestedLevel}`)
    .setDescription(
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