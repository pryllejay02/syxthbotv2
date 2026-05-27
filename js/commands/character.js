const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");

module.exports = async function characterCommand(message) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();

  const equipment = player.equipment || {
    weapon: null,
    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };

  const dodge = Number(player.dodge ?? 0);
  const crit = Number(player.crit ?? 0);

function showEquipment(item, emptyText) {
  if (!item) return `Empty ${emptyText}`;

  const qualityEmoji =
    item.quality === "Starter"
      ? "🌱"
      : getQualityEmoji(item.quality);

  const stats = item.stats || {};

  return (
    `${item.emoji || "📦"} ${item.name}\n` +
    `└ ${qualityEmoji} ${item.quality || "Common"} | ` +
    `Lv.${item.requiredLevel || 1}\n` +

    `└ ⚔️${stats.attack || 0} ` +
    `🛡️${stats.defense || 0} ` +
    `❤️${stats.maxHp || 0} ` +
    `💨${stats.dodge || 0}% ` +
    `💥${stats.crit || 0}%`
  );
}

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("🧙 SYXTH CHARACTER")
    .setDescription(
      `👤 **${player.username}**\n` +
        `${player.classEmoji || "⚔️"} Class: **${player.class || "Novice"}**\n` +
        `⭐ Level: **${player.level || 1}**\n` +
        `❤️ HP: **${player.hp || 0}/${player.maxHp || 100}**\n` +
        `⚔️ Attack: **${player.attack || 10}**\n` +
        `🛡️ Defense: **${player.defense || 5}**\n` +
        `💨 Dodge: **${dodge.toFixed(1)}%**\n` +
        `💥 Crit: **${crit.toFixed(1)}%**\n\n` +

        `━━━━━━━━━━━━━━━━━━\n\n` +

        `**Weapon:** ${showEquipment(equipment.weapon, "Weapon")}\n\n` +
        `**Helmet:** ${showEquipment(equipment.helmet, "Helmet")}\n\n` +
        `**Armor:** ${showEquipment(equipment.armor, "Armor")}\n\n` +
        `**Gloves:** ${showEquipment(equipment.gloves, "Gloves")}\n\n` +
        `**Pants:** ${showEquipment(equipment.pants, "Pants")}\n\n` +
        `**Boots:** ${showEquipment(equipment.boots, "Boots")}\n\n` +

        `━━━━━━━━━━━━━━━━━━\n` +
        `Equip: \`!s equip <item_id>\`\n` +
        `Unequip: \`!s unequip <slot>\``
    )
    .setThumbnail(
      message.author.displayAvatarURL({
        dynamic: true,
      })
    )
    .setFooter({
      text: "Syxth MMORPG Character Equipment",
    });

  return message.reply({
    embeds: [embed],
  });
};