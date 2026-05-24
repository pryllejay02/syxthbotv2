const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");

function getItemEmoji(item) {
  if (item.emoji) return item.emoji;

  const type = String(item.type || "").toLowerCase();

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
            const emoji = getItemEmoji(item);
            const qualityEmoji = getQualityEmoji(item.quality);
            const quantity = item.quantity || 1;

            return (
              `${emoji} ${qualityEmoji} **${item.name || "Unknown Item"}** x${quantity}\n` +
              `└ ${qualityEmoji} ${item.quality || "Common"} • ${item.type || "Unknown"} • Lv.${item.requiredLevel || 1}\n` +
              `└ ID: \`${item.id}\``
            );
          })
          .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("🎒 SYXTH INVENTORY")
    .setDescription(
      `👤 ${player.username}\n` +
        `🎭 Class: ${player.class || "Unknown"}\n` +
        `🪙 Gold: ${player.gold || 0}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `${itemsText}`
    )
    .setThumbnail(
      message.author.displayAvatarURL({
        dynamic: true,
      })
    )
    .setFooter({
      text: "Syxth MMORPG Inventory",
    });

  return message.reply({
    embeds: [embed],
  });
};