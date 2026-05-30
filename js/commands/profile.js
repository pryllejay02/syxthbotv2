const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const { getRequiredExp, MAX_LEVEL } = require("../utils/levelSystem");
const { getPlayerRank } = require("../data/ranks");
const { getQualityEmoji } = require("../utils/qualitySystem");
const {
  getReviveRemainingSeconds,
  resolvePlayerRevive,
} = require("../utils/reviveSystem");

function createBar(current, max, size = 10) {
  if (max <= 0) return "░".repeat(size);

  const safeCurrent = Math.max(0, Math.min(current, max));
  const percentage = safeCurrent / max;
  const filled = Math.round(size * percentage);
  const empty = size - filled;

  return "█".repeat(filled) + "░".repeat(empty);
}

function calculatePower(player) {
  const attack = Number(player.attack || 0);
  const defense = Number(player.defense || 0);
  const maxHp = Number(player.maxHp || 0);
  const dodge = Number(player.dodge || 0);
  const crit = Number(player.crit || 0);
  const level = Number(player.level || 1);

  return Math.floor(
    attack +
      defense * 1.5 +
      maxHp * 0.2 +
      dodge * 10 +
      crit * 10 +
      level * 100
  );
}

function countEquippedItems(equipment = {}) {
  return Object.values(equipment).filter(Boolean).length;
}

function getWeaponDisplay(player) {
  const equipment = player.equipment || {};
  const equippedWeapon = equipment.weapon;

  const defaultWeaponByClass = {
    swordsman: "🗡️ Wooden Sword",
    archer: "🏹 Wooden Bow",
    assassin: "🗡️ Training Dagger",
    tanker: "🛡️ Wooden Shield",
  };

  const weapon = equippedWeapon
    ? `${equippedWeapon.emoji || "🗡️"} ${equippedWeapon.name}`
    : defaultWeaponByClass[player.classId] ||
      player.weapon ||
      "🗡️ Wooden Sword";

  const weaponQuality = equippedWeapon
    ? equippedWeapon.quality === "Starter"
      ? "🌱 Starter"
      : `${getQualityEmoji(equippedWeapon.quality)} ${equippedWeapon.quality}`
    : "🌱 Starter";

  return {
    weapon,
    weaponQuality,
  };
}

module.exports = async function profileCommand(message) {
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

  const level = Number(player.level ?? 1);
  const exp = Number(player.exp ?? 0);
  const hp = Number(player.hp ?? 100);
  const maxHp = Number(player.maxHp ?? 100);
  const gold = Number(player.gold ?? 0);
  const attack = Number(player.attack ?? 10);
  const defense = Number(player.defense ?? 5);
  const dodge = Number(player.dodge ?? 0);
  const crit = Number(player.crit ?? 0);

  const playerClass = player.class || "Novice";
  const worldName = player.world?.name || "No World Selected";
  const rank = getPlayerRank(level);
  const status = hp <= 0 ? "Defeated 💀" : "Alive 🟢";
  const power = calculatePower(player);

  const equipment = player.equipment || {};
  const equippedCount = countEquippedItems(equipment);

  const monsterKills = Number(player.monsterKills || 0);
  const retreats = Number(player.retreats || 0);

  const requiredExp = level >= MAX_LEVEL ? 0 : getRequiredExp(level);

  const expDisplay =
    level >= MAX_LEVEL
      ? "MAX LEVEL"
      : `${exp}/${requiredExp}`;

  const expBar =
    level >= MAX_LEVEL
      ? "██████████"
      : createBar(exp, requiredExp);

  const hpBar = createBar(hp, maxHp);

  let reviveText = "Available";

  if (hp <= 0) {
    const remainingSeconds = getReviveRemainingSeconds(player);

    reviveText =
      remainingSeconds > 0
        ? `Free revive in ${remainingSeconds}s`
        : "Free revive ready";
  }

  const { weapon, weaponQuality } = getWeaponDisplay(player);

  const revivedNotice = reviveResult.revived
    ? `✨ **Auto Revive Recovered:** ${reviveResult.revivedHp}/${maxHp} HP\n\n`
    : "";

  const embed = new EmbedBuilder()
    .setColor(hp <= 0 ? "#2B2B2B" : "#8B0000")
    .setTitle("⚔️ SYXTH MMORPG PROFILE")
    .setDescription(
      `${revivedNotice}` +
        `**Adventurer:** ${player.username || message.author.username}\n` +
        `**Class:** ${player.classEmoji || "⚔️"} ${playerClass}\n` +
        `**Level:** ${level}/${MAX_LEVEL}\n` +
        `**Rank:** ${rank}\n` +
        `**Status:** ${status}\n` +
        `**Power:** ${power}\n\n` +
        `❤️ **HP**\n` +
        `\`${hpBar}\` **${hp}/${maxHp}**\n\n` +
        `⭐ **EXP**\n` +
        `\`${expBar}\` **${expDisplay}**`
    )
    .addFields(
      {
        name: "⚔️ Combat Stats",
        value:
          `**Attack:** ${attack}\n` +
          `**Defense:** ${defense}\n` +
          `**Dodge:** ${dodge.toFixed(1)}%\n` +
          `**Crit:** ${crit.toFixed(1)}%\n` +
          `**Weapon:** ${weapon}\n` +
          `**Weapon Quality:** ${weaponQuality}`,
        inline: true,
      },
      {
        name: "🎒 Inventory / Equipment",
        value:
          `**Gold:** ${gold}\n` +
          `**Inventory Items:** ${(player.inventory || []).length}\n` +
          `**Equipped Slots:** ${equippedCount}/6\n` +
          `**Revive:** ${reviveText}`,
        inline: true,
      },
      {
        name: "📊 Adventure Record",
        value:
          `**Monster Kills:** ${monsterKills}\n` +
          `**Retreats:** ${retreats}\n` +
          `**World:** ${worldName}\n` +
          `**ID:** ${userId}`,
        inline: false,
      }
    )
    .setThumbnail(
      message.author.displayAvatarURL({
        dynamic: true,
      })
    )
    .setFooter({
      text: "Syxth MMORPG • Use !s hunt to start a battle",
    });

  return message.reply({
    embeds: [embed],
  });
};