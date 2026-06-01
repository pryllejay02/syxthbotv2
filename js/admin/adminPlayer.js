const { db } = require("../../firebase/firebase");
const {
  calculateTotalStats,
  getDefaultEquipment,
} = require("../utils/statSystem");
const balanceConfig = require("../data/balanceConfig");

function getMention(message) {
  return message.mentions.users.first();
}

function getMaxLevel() {
  return Number(balanceConfig.MAX_LEVEL || balanceConfig.maxLevel || 99);
}

function parsePositiveInteger(value) {
  const amount = Number(value);

  if (!Number.isInteger(amount)) return null;
  if (amount <= 0) return null;

  return amount;
}

function parseLevel(value) {
  const level = Number(value);
  const maxLevel = getMaxLevel();

  if (!Number.isInteger(level)) return null;
  if (level < 1) return null;
  if (level > maxLevel) return null;

  return level;
}

function getBaseStatsByClassLevel(classId, level) {
  if (typeof balanceConfig.getBaseStatsByClassLevel === "function") {
    return balanceConfig.getBaseStatsByClassLevel(classId, level);
  }

  return {
    attack: 10,
    defense: 5,
    maxHp: 100,
    dodge: 0,
    crit: 0,
  };
}

function getSafeEquipment(player = {}) {
  return {
    ...getDefaultEquipment(),
    ...(player.equipment || {}),
  };
}

function recalculatePlayerStats(player = {}, targetLevel = null) {
  const level = Number(targetLevel || player.level || 1);
  const classId = player.classId || "swordsman";
  const baseStats = getBaseStatsByClassLevel(classId, level);
  const equipment = getSafeEquipment(player);
  const totalStats = calculateTotalStats(baseStats, equipment);

  return {
    level,
    classId,
    baseStats,
    equipment,
    totalStats,
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
  const legendary = inventory.filter(
    (item) => item.quality === "Legendary"
  ).length;

  return {
    stacks: inventory.length,
    totalQuantity,
    starter,
    common,
    rare,
    legendary,
  };
}

function getAdminReviveHp(maxHp) {
  const revivePercent = Number(
    balanceConfig.revive?.freeReviveHpPercent || 50
  );

  return Math.max(
    1,
    Math.floor(Number(maxHp || 100) * (revivePercent / 100))
  );
}

module.exports = async function adminPlayer(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (!target || target.bot) {
    return message.reply("❌ Please mention a valid player.");
  }

  const playerRef = db.collection("players").doc(target.id);

  if (subCommand === "givegold") {
    const amount = parsePositiveInteger(args[2]);

    if (!amount) {
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
        updatedAt: new Date(),
      });

      return {
        ok: true,
        player,
        oldGold,
        newGold,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Give gold failed.");
    }

    return message.reply(
      `✅ Gave **${amount} Gold** to **${
        result.player.username || target.username
      }**.\n\n` +
        `🪙 Old Gold: **${result.oldGold}**\n` +
        `🪙 New Gold: **${result.newGold}**`
    );
  }

  if (subCommand === "setlevel") {
    const level = parseLevel(args[2]);
    const maxLevel = getMaxLevel();

    if (!level) {
      return message.reply(
        `❌ Usage: \`!s admin setlevel @player <1-${maxLevel}>\``
      );
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
      const recalculated = recalculatePlayerStats(player, level);

      transaction.update(playerRef, {
        level,
        exp: 0,

        baseStats: recalculated.baseStats,
        equipment: recalculated.equipment,

        attack: recalculated.totalStats.attack,
        defense: recalculated.totalStats.defense,
        maxHp: recalculated.totalStats.maxHp,
        dodge: recalculated.totalStats.dodge,
        crit: recalculated.totalStats.crit,
        hp: recalculated.totalStats.maxHp,

        reviveAvailableAt: null,
        raidReviveAvailableAt: null,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        player,
        classId: recalculated.classId,
        totalStats: recalculated.totalStats,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Set level failed.");
    }

    return message.reply(
      `✅ **${result.player.username || target.username}** is now **Lv.${level}**.\n\n` +
        `🎭 Class: **${result.classId}**\n` +
        `⭐ EXP: **0**\n` +
        `⚔️ ATK: **${result.totalStats.attack}**\n` +
        `🛡️ DEF: **${result.totalStats.defense}**\n` +
        `❤️ HP: **${result.totalStats.maxHp}/${result.totalStats.maxHp}**\n` +
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
        updatedAt: new Date(),
      });

      return {
        ok: true,
        player,
        maxHp,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Heal failed.");
    }

    return message.reply(
      `❤️ **${result.player.username || target.username}** has been fully healed.\n\n` +
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
      const reviveHp = getAdminReviveHp(maxHp);

      transaction.update(playerRef, {
        hp: reviveHp,
        reviveAvailableAt: null,
        raidReviveAvailableAt: null,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        player,
        reviveHp,
        maxHp,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Revive failed.");
    }

    return message.reply(
      `✨ **${result.player.username || target.username}** revived.\n\n` +
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
      `🎒 **${player.username || target.username}'s Inventory Summary**\n\n` +
        `🪙 Gold: **${player.gold || 0}**\n` +
        `📦 Item Stacks: **${summary.stacks}**\n` +
        `📦 Total Quantity: **${summary.totalQuantity}**\n\n` +
        `🌱 Starter: **${summary.starter}**\n` +
        `🟢 Common: **${summary.common}**\n` +
        `🔵 Rare: **${summary.rare}**\n` +
        `🟠 Legendary: **${summary.legendary}**`
    );
  }

  if (subCommand === "repairplayer") {
    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const inventory = Array.isArray(player.inventory)
        ? player.inventory
        : [];

      const recalculated = recalculatePlayerStats(player);

      const currentHp = Number(player.hp ?? recalculated.totalStats.maxHp);
      const repairedHp =
        currentHp <= 0
          ? 0
          : Math.min(currentHp, Number(recalculated.totalStats.maxHp || 100));

      transaction.update(playerRef, {
        level: recalculated.level,
        exp: Number(player.exp || 0),
        gold: Number(player.gold || 0),

        baseStats: recalculated.baseStats,
        equipment: recalculated.equipment,
        inventory,

        attack: recalculated.totalStats.attack,
        defense: recalculated.totalStats.defense,
        maxHp: recalculated.totalStats.maxHp,
        dodge: recalculated.totalStats.dodge,
        crit: recalculated.totalStats.crit,
        hp: repairedHp,

        monsterKills: Number(player.monsterKills || 0),
        retreats: Number(player.retreats || 0),

        reviveAvailableAt: player.reviveAvailableAt || null,
        raidReviveAvailableAt: player.raidReviveAvailableAt || null,

        updatedAt: new Date(),
      });

      return {
        ok: true,
        player,
        repairedHp,
        totalStats: recalculated.totalStats,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Repair player failed.");
    }

    return message.reply(
      `✅ Repaired player data for **${result.player.username || target.username}**.\n\n` +
        `❤️ HP: **${result.repairedHp}/${result.totalStats.maxHp}**\n` +
        `⚔️ ATK: **${result.totalStats.attack}**\n` +
        `🛡️ DEF: **${result.totalStats.defense}**\n` +
        `💨 Dodge: **${result.totalStats.dodge}%**\n` +
        `💥 Crit: **${result.totalStats.crit}%**`
    );
  }

  return message.reply(
    "❌ Unknown player admin command.\n\n" +
      "Available:\n" +
      "`!s admin givegold @player <amount>`\n" +
      "`!s admin setlevel @player <1-99>`\n" +
      "`!s admin heal @player`\n" +
      "`!s admin revive @player`\n" +
      "`!s admin inventory @player`\n" +
      "`!s admin repairplayer @player`"
  );
};