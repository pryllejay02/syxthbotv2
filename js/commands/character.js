const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");
const {
  getReviveRemainingSeconds,
  resolvePlayerRevive,
} = require("../utils/reviveSystem");
const balanceConfig = require("../data/balanceConfig");

function getDefaultEquipment() {
  return {
    weapon: null,
    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };
}

function calculatePower(player) {
  return balanceConfig.calculatePower(player);
}

function countEquippedItems(equipment = {}) {
  return Object.values(equipment).filter(Boolean).length;
}

function formatStats(stats = {}) {
  const parts = [];

  if (stats.attack) parts.push(`⚔️ ATK ${stats.attack}`);
  if (stats.defense) parts.push(`🛡️ DEF ${stats.defense}`);
  if (stats.maxHp) parts.push(`❤️ HP ${stats.maxHp}`);
  if (stats.dodge) parts.push(`💨 Dodge ${stats.dodge}%`);
  if (stats.crit) parts.push(`💥 Crit ${stats.crit}%`);

  return parts.length ? parts.join(" • ") : "No bonus stats";
}

function formatClass(classes = []) {
  if (!Array.isArray(classes)) return "All";

  return classes
    .map((cls) => {
      const text = String(cls || "all");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(", ");
}

function showEquipment(item, emptyText) {
  if (!item) {
    return (
      `*Empty ${emptyText}*\n` +
      `└ Equip using \`!s equip <item_id>\``
    );
  }

  const qualityEmoji =
    item.quality === "Starter"
      ? "🌱"
      : getQualityEmoji(item.quality || "Common");

  return (
    `${item.emoji || "📦"} **${item.name || "Unknown Item"}**\n` +
    `└ ${qualityEmoji} ${item.quality || "Common"} • ${item.type || "Unknown"}\n` +
    `└ 🔓 Lv.${item.requiredLevel || 1}\n` +
    `└ 🎭 ${formatClass(item.compatibleClasses || ["all"])}\n` +
    `└ 📊 ${formatStats(item.stats || {})}\n` +
    `└ 🏷️ \`${item.id || "no-id"}\``
  );
}

module.exports = async function characterCommand(message) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "You don’t have a character yet. Use `!s start` first."
    );
  }

  let player = playerDoc.data();

  // Recover revive if the timer became ready while the bot was offline.
  const reviveResult = await resolvePlayerRevive(playerRef, player);
  player = reviveResult.player;

  const equipment = {
    ...getDefaultEquipment(),
    ...(player.equipment || {}),
  };

  const level = Number(player.level || 1);
  const hp = Number(player.hp || 0);
  const maxHp = Number(player.maxHp || 100);
  const attack = Number(player.attack || 10);
  const defense = Number(player.defense || 5);
  const dodge = Number(player.dodge || 0);
  const crit = Number(player.crit || 0);
  const gold = Number(player.gold || 0);

  const power = calculatePower(player);
  const equippedCount = countEquippedItems(equipment);

  const status = hp <= 0 ? "Defeated 💀" : "Alive 🟢";

  let reviveText = "Available";

  if (hp <= 0) {
    const remainingSeconds = getReviveRemainingSeconds(player);

    reviveText =
      remainingSeconds > 0
        ? `Free revive in ${remainingSeconds}s`
        : "Free revive ready";
  }

  const revivedNotice = reviveResult.revived
    ? `✨ **Auto Revive Recovered:** ${reviveResult.revivedHp}/${maxHp} HP\n\n`
    : "";

  const embed = new EmbedBuilder()
    .setColor(hp <= 0 ? "#2B2B2B" : "#8B0000")
    .setTitle("🧙 SYXTH CHARACTER EQUIPMENT")
    .setDescription(
      `${revivedNotice}` +
        `👤 **${player.username || message.author.username}**\n` +
        `${player.classEmoji || "⚔️"} Class: **${player.class || "Novice"}**\n` +
        `⭐ Level: **${level}**\n` +
        `📊 Status: **${status}**\n` +
        `⚡ Power: **${power}**\n` +
        `🪙 Gold: **${gold}**\n` +
        `🎒 Equipped: **${equippedCount}/6**\n` +
        `✨ Revive: **${reviveText}**\n\n` +

        `❤️ HP: **${hp}/${maxHp}**\n` +
        `⚔️ Attack: **${attack}**\n` +
        `🛡️ Defense: **${defense}**\n` +
        `💨 Dodge: **${dodge.toFixed(1)}%**\n` +
        `💥 Crit: **${crit.toFixed(1)}%**\n\n` +

        `━━━━━━━━━━━━━━━━━━\n\n` +

        `🗡️ **Weapon**\n${showEquipment(equipment.weapon, "Weapon")}\n\n` +
        `⛑️ **Helmet**\n${showEquipment(equipment.helmet, "Helmet")}\n\n` +
        `🦺 **Armor**\n${showEquipment(equipment.armor, "Armor")}\n\n` +
        `🧤 **Gloves**\n${showEquipment(equipment.gloves, "Gloves")}\n\n` +
        `👖 **Pants**\n${showEquipment(equipment.pants, "Pants")}\n\n` +
        `🥾 **Boots**\n${showEquipment(equipment.boots, "Boots")}\n\n` +

        `━━━━━━━━━━━━━━━━━━\n` +
        `Equip: \`!s equip <item_id>\`\n` +
        `Unequip: \`!s unequip <slot>\`\n` +
        `Slots: \`weapon\`, \`helmet\`, \`armor\`, \`gloves\`, \`pants\`, \`boots\``
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