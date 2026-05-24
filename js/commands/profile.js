const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const { getRequiredExp, MAX_LEVEL } = require("../utils/levelSystem");
const { getPlayerRank } = require("../data/ranks");
const { getQualityEmoji } = require("../utils/qualitySystem");

function createBar(current, max, size = 10) {
  if (max <= 0) return "░".repeat(size);

  const safeCurrent = Math.max(0, Math.min(current, max));
  const percentage = safeCurrent / max;
  const filled = Math.round(size * percentage);
  const empty = size - filled;

  return "█".repeat(filled) + "░".repeat(empty);
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

  const player = playerDoc.data();

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

  const equipment = player.equipment || {};
  const equippedWeapon = equipment.weapon;

  const defaultWeaponByClass = {
    swordsman: "🗡️ 🌱 Wooden Sword",
    archer: "🏹 🌱 Wooden Bow",
    assassin: "🗡️ 🌱 Training Dagger",
    tanker: "🛡️ 🌱 Wooden Shield",
  };

  const weapon = equippedWeapon
    ? `${equippedWeapon.emoji || "🗡️"} ${
        equippedWeapon.quality === "Starter"
          ? "🌱"
          : getQualityEmoji(equippedWeapon.quality)
      } ${equippedWeapon.name}`
    : defaultWeaponByClass[player.classId] || player.weapon || "🗡️ 🌱 Wooden Sword";

  const worldName = player.world?.name || "No World Selected";
  const rank = getPlayerRank(level);
  const status = hp <= 0 ? "Defeated 💀" : "Alive 🟢";

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

  if (hp <= 0 && player.reviveAvailableAt) {
    const now = Date.now();
    const reviveAvailableAt = Number(player.reviveAvailableAt);
    const remainingSeconds = Math.max(
      0,
      Math.ceil((reviveAvailableAt - now) / 1000)
    );

    reviveText =
      remainingSeconds > 0
        ? `Free revive in ${remainingSeconds}s`
        : "Free revive ready";
  }

  const embed = new EmbedBuilder()
    .setColor(hp <= 0 ? "#2B2B2B" : "#8B0000")
    .setTitle("⚔️ SYXTH MMORPG PROFILE")
    .setDescription(
      `**Adventurer:** ${player.username}\n` +
        `**Class:** ${playerClass}\n` +
        `**Level:** ${level}/${MAX_LEVEL}\n` +
        `**Status:** ${status}\n\n` +
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
          `**Weapon:** ${weapon}`,
        inline: true,
      },
      {
        name: "🎒 Inventory Stats",
        value:
          `**Gold:** ${gold}\n` +
          `**Items:** ${(player.inventory || []).length}\n` +
          `**Revive:** ${reviveText}`,
        inline: true,
      },
      {
        name: "📜 Character Info",
        value:
          `**ID:** ${userId}\n` +
          `**Rank:** ${rank}\n` +
          `**World:** ${worldName}`,
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