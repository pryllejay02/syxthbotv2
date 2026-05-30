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

function getInventorySummary(inventory = []) {
  const totalQuantity = inventory.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );

  const starter = inventory.filter((item) => item.quality === "Starter").length;
  const common = inventory.filter((item) => item.quality === "Common").length;
  const rare = inventory.filter((item) => item.quality === "Rare").length;
  const legendary = inventory.filter((item) => item.quality === "Legendary").length;

  return {
    stacks: inventory.length,
    totalQuantity,
    starter,
    common,
    rare,
    legendary,
  };
}

module.exports = async function adminPlayer(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (!target || target.bot) {
    return message.reply("❌ Please mention a valid player.");
  }

  const playerRef = db.collection("players").doc(target.id);

  if (subCommand === "givegold") {
    const amount = Number(args[2]);

    if (!amount || amount <= 0) {
      return message.reply("❌ Usage: `!s admin givegold @player <amount>`");
    }

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const oldGold = Number(player.gold || 0);
      const newGold = oldGold + amount;

      transaction.update(playerRef, {
        gold: newGold,
      });

      return {
        ok: true,
        oldGold,
        newGold,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Give gold failed.");
    }

    return message.reply(
      `✅ Gave **${amount} Gold** to ${target.username}.\n\n` +
        `🪙 Old Gold: **${result.oldGold}**\n` +
        `🪙 New Gold: **${result.newGold}**`
    );
  }

  if (subCommand === "setlevel") {
    const level = Number(args[2]);

    if (!level || level < 1 || level > 99) {
      return message.reply("❌ Usage: `!s admin setlevel @player <1-99>`");
    }

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const classId = player.classId || "swordsman";
      const baseStats = getBaseStatsByClassLevel(classId, level);
      const equipment = player.equipment || {};
      const totalStats = calculateTotalStats(baseStats, equipment);

      transaction.update(playerRef, {
        level,
        exp: 0,
        baseStats,
        attack: totalStats.attack,
        defense: totalStats.defense,
        maxHp: totalStats.maxHp,
        dodge: totalStats.dodge,
        crit: totalStats.crit,
        hp: totalStats.maxHp,
        reviveAvailableAt: null,
        raidReviveAvailableAt: null,
      });

      return {
        ok: true,
        classId,
        totalStats,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Set level failed.");
    }

    return message.reply(
      `✅ ${target.username} is now **Lv.${level}**.\n\n` +
        `🎭 Class: **${result.classId}**\n` +
        `⚔️ ATK: **${result.totalStats.attack}**\n` +
        `🛡️ DEF: **${result.totalStats.defense}**\n` +
        `❤️ HP: **${result.totalStats.maxHp}**\n` +
        `💨 Dodge: **${result.totalStats.dodge}%**\n` +
        `💥 Crit: **${result.totalStats.crit}%**`
    );
  }

  if (subCommand === "heal") {
    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const maxHp = Number(player.maxHp || 100);

      transaction.update(playerRef, {
        hp: maxHp,
      });

      return {
        ok: true,
        maxHp,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Heal failed.");
    }

    return message.reply(
      `❤️ ${target.username} has been fully healed.\n\n` +
        `HP: **${result.maxHp}/${result.maxHp}**`
    );
  }

  if (subCommand === "revive") {
    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const maxHp = Number(player.maxHp || 100);
      const reviveHp = Math.floor(maxHp * 0.5);

      transaction.update(playerRef, {
        hp: reviveHp,
        reviveAvailableAt: null,
        raidReviveAvailableAt: null,
      });

      return {
        ok: true,
        reviveHp,
        maxHp,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Revive failed.");
    }

    return message.reply(
      `✨ ${target.username} revived.\n\n` +
        `HP: **${result.reviveHp}/${result.maxHp}**`
    );
  }

  if (subCommand === "inventory") {
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      return message.reply("❌ Character not found.");
    }

    const player = playerDoc.data();
    const inventory = Array.isArray(player.inventory)
      ? player.inventory
      : [];

    const summary = getInventorySummary(inventory);

    return message.reply(
      `🎒 **${target.username}'s Inventory Summary**\n\n` +
        `🪙 Gold: **${player.gold || 0}**\n` +
        `📦 Item Stacks: **${summary.stacks}**\n` +
        `📦 Total Quantity: **${summary.totalQuantity}**\n\n` +
        `🌱 Starter: **${summary.starter}**\n` +
        `🟢 Common: **${summary.common}**\n` +
        `🔵 Rare: **${summary.rare}**\n` +
        `🟠 Legendary: **${summary.legendary}**`
    );
  }

  return message.reply(
    "❌ Unknown player admin command.\n\n" +
      "Available:\n" +
      "`!s admin givegold @player <amount>`\n" +
      "`!s admin setlevel @player <1-99>`\n" +
      "`!s admin heal @player`\n" +
      "`!s admin revive @player`\n" +
      "`!s admin inventory @player`"
  );
};