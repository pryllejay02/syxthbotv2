const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");

function getMention(message) {
  return message.mentions.users.first();
}

function getBaseStatsByClassLevel(classId, level) {
  const lv = Math.max(1, Number(level || 1));

  const growth = {
    swordsman: {
      attack: 10 + lv * 3,
      defense: 6 + lv * 2,
      maxHp: 110 + lv * 15,
      dodge: 2 + lv * 0.05,
      crit: 4 + lv * 0.05,
    },
    archer: {
      attack: 12 + lv * 3.5,
      defense: 4 + lv * 1.3,
      maxHp: 90 + lv * 11,
      dodge: 4 + lv * 0.08,
      crit: 8 + lv * 0.12,
    },
    assassin: {
      attack: 13 + lv * 3.7,
      defense: 3 + lv * 1.1,
      maxHp: 85 + lv * 10,
      dodge: 7 + lv * 0.13,
      crit: 10 + lv * 0.15,
    },
    tanker: {
      attack: 8 + lv * 2.2,
      defense: 10 + lv * 3,
      maxHp: 150 + lv * 22,
      dodge: 1 + lv * 0.03,
      crit: 2 + lv * 0.03,
    },
  };

  const stats = growth[classId] || growth.swordsman;

  return {
    attack: Math.floor(stats.attack),
    defense: Math.floor(stats.defense),
    maxHp: Math.floor(stats.maxHp),
    dodge: Number(stats.dodge.toFixed(1)),
    crit: Number(stats.crit.toFixed(1)),
  };
}

module.exports = async function adminPlayer(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (!target || target.bot) {
    return message.reply("❌ Please mention a valid player.");
  }

  const playerRef = db.collection("players").doc(target.id);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("❌ Character not found.");
  }

  const player = playerDoc.data();

  if (subCommand === "givegold") {
    const amount = Number(args[2]);

    if (!amount || amount <= 0) {
      return message.reply("❌ Usage: `!s admin givegold @player <amount>`");
    }

    await playerRef.update({
      gold: Number(player.gold || 0) + amount,
    });

    return message.reply(`✅ Gave **${amount} gold** to ${target.username}.`);
  }

  if (subCommand === "setlevel") {
    const level = Number(args[2]);

    if (!level || level < 1 || level > 99) {
      return message.reply("❌ Usage: `!s admin setlevel @player <1-99>`");
    }

    const classId = player.classId || "swordsman";
    const baseStats = getBaseStatsByClassLevel(classId, level);
    const equipment = player.equipment || {};
    const totalStats = calculateTotalStats(baseStats, equipment);

    await playerRef.update({
      level,
      exp: 0,
      baseStats,
      attack: totalStats.attack,
      defense: totalStats.defense,
      maxHp: totalStats.maxHp,
      dodge: totalStats.dodge,
      crit: totalStats.crit,
      hp: totalStats.maxHp,
    });

    return message.reply(
      `✅ ${target.username} is now **Lv.${level}**.\n` +
        `⚔️ ATK: ${totalStats.attack}\n` +
        `🛡️ DEF: ${totalStats.defense}\n` +
        `❤️ HP: ${totalStats.maxHp}\n` +
        `💨 Dodge: ${totalStats.dodge}%\n` +
        `💥 Crit: ${totalStats.crit}%`
    );
  }

  if (subCommand === "heal") {
    await playerRef.update({
      hp: Number(player.maxHp || 100),
    });

    return message.reply(`❤️ ${target.username} has been fully healed.`);
  }

  if (subCommand === "revive") {
    const reviveHp = Math.floor(Number(player.maxHp || 100) * 0.5);

    await playerRef.update({
      hp: reviveHp,
      reviveAvailableAt: null,
      raidReviveAvailableAt: null,
    });

    return message.reply(`✨ ${target.username} revived with **${reviveHp} HP**.`);
  }

  if (subCommand === "inventory") {
    const inventory = player.inventory || [];

    return message.reply(
      `🎒 **${target.username}'s Inventory**\n` +
        `Items: **${inventory.length}**\n` +
        `Gold: **${player.gold || 0}**`
    );
  }

  return message.reply("❌ Unknown player admin command.");
};