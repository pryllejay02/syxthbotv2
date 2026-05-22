const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");

function getItemEmoji(item, shopItem) {
  if (item.emoji) return item.emoji;
  if (shopItem?.emoji) return shopItem.emoji;

  const type = String(item.type || shopItem?.type || "").toLowerCase();

  if (type === "weapon") return "🗡️";
  if (type === "helmet") return "⛑️";
  if (type === "armor") return "🛡️";
  if (type === "gloves") return "🧤";
  if (type === "pants") return "👖";
  if (type === "boots") return "🥾";
  if (type === "consumable") return "🧪";

  return "📦";
}

module.exports = async function inventoryCommand(message) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();
  const inventory = player.inventory || [];

  const itemsText =
    inventory.length === 0
      ? "❌ Inventory Empty"
      : inventory
          .map((item) => {
            const shopItem = shopItems.find(
              (shopItem) => shopItem.id === item.id
            );

            const emoji = getItemEmoji(item, shopItem);
            const name = item.name || shopItem?.name || "Unknown Item";
            const quantity = item.quantity || 1;
            const quality = item.quality || shopItem?.quality || "Common";
            const type = item.type || shopItem?.type || "Unknown";
            const requiredLevel =
              item.requiredLevel || shopItem?.requiredLevel || 1;

            return (
              `${emoji} **${name}** x${quantity}\n` +
              `└ ${quality} • ${type} • Lv.${requiredLevel}`
            );
          })
          .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("🎒 SYXTH INVENTORY")
    .setDescription(
      `👤 ${player.username}\n` +
      `🪙 Gold: ${player.gold || 0}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `${itemsText}`
    )
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setFooter({
      text: "Syxth MMORPG Inventory",
    });

  return message.reply({ embeds: [embed] });
};