const { db } = require("../../firebase/firebase");

const {
  calculateTotalStats,
  getDefaultEquipment,
} = require("../utils/statSystem");

const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("../utils/qualitySystem");

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

function getStarterWeaponByClass(classId) {
  const weapons = {
    swordsman: {
      name: "Wooden Sword",
      emoji: "🗡️",
    },

    archer: {
      name: "Wooden Bow",
      emoji: "🏹",
    },

    assassin: {
      name: "Training Dagger",
      emoji: "🗡️",
    },

    tanker: {
      name: "Wooden Shield",
      emoji: "🛡️",
    },
  };

  return weapons[classId] || weapons.swordsman;
}

function getDefaultStats() {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
    dodge: 0,
    crit: 0,
  };
}

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
}

function getQuality(item = {}) {
  return item.quality || "Common";
}

function isStarterItem(item = {}) {
  return (
    item.quality === "Starter" ||
    item.source === "starter" ||
    item.isStarter === true
  );
}

function isConsumable(item = {}) {
  return String(item.type || "").toLowerCase() === "consumable";
}

function findBaseShopItem(item = {}) {
  const candidateIds = [item.baseItemId, item.id]
    .filter(Boolean)
    .map(normalizeId);

  for (const candidateId of candidateIds) {
    const exactMatch = shopItems.find(
      (shopItem) => normalizeId(shopItem.id) === candidateId
    );

    if (exactMatch) return exactMatch;
  }

  const itemId = normalizeId(item.id);

  if (!itemId) return null;

  const prefixMatches = shopItems
    .filter((shopItem) => itemId.startsWith(normalizeId(shopItem.id)))
    .sort(
      (a, b) =>
        normalizeId(b.id).length - normalizeId(a.id).length
    );

  return prefixMatches[0] || null;
}

function getRollConfigBySource(item = {}, quality = "Common") {
  const source = String(item.source || "").toLowerCase();

  if (source === "boss_raid") {
    return balanceConfig.bossDrop?.statRolls?.[quality] || null;
  }

  if (source === "monster_drop") {
    return balanceConfig.monsterDrop?.statRolls?.[quality] || null;
  }

  if (source === "admin_generated" || source === "admin") {
    return balanceConfig.adminItem?.statRolls?.[quality] || null;
  }

  return null;
}

function getDeterministicMultiplier(item = {}, quality = "Common") {
  if (quality === "Starter") return 0;

  const source = String(item.source || "").toLowerCase();

  if (!source || source === "shop") {
    return Number(balanceConfig.quality?.[quality]?.statMultiplier || 1);
  }

  const rollConfig = getRollConfigBySource(item, quality);

  if (rollConfig) {
    const min = Number(rollConfig.min || 1);
    const max = Number(rollConfig.max || min);

    return Number(((min + max) / 2).toFixed(3));
  }

  if (quality === "Rare") {
    const rollConfig =
      balanceConfig.monsterDrop?.statRolls?.Rare ||
      balanceConfig.adminItem?.statRolls?.Rare;

    if (rollConfig) {
      const min = Number(rollConfig.min || 1);
      const max = Number(rollConfig.max || min);

      return Number(((min + max) / 2).toFixed(3));
    }
  }

  if (quality === "Legendary") {
    const rollConfig =
      balanceConfig.bossDrop?.statRolls?.Legendary ||
      balanceConfig.adminItem?.statRolls?.Legendary;

    if (rollConfig) {
      const min = Number(rollConfig.min || 1);
      const max = Number(rollConfig.max || min);

      return Number(((min + max) / 2).toFixed(3));
    }
  }

  return Number(balanceConfig.quality?.[quality]?.statMultiplier || 1);
}

function getPriceMultiplierBySource(item = {}, quality = "Common") {
  const source = String(item.source || "").toLowerCase();

  if (source === "boss_raid") {
    return Number(balanceConfig.bossDrop?.priceMultiplier?.[quality] || 1);
  }

  if (source === "monster_drop") {
    return Number(balanceConfig.monsterDrop?.priceMultiplier?.[quality] || 1);
  }

  return Number(balanceConfig.quality?.[quality]?.priceMultiplier || 1);
}

function scaleStats(stats = {}, multiplier = 1) {
  return {
    attack: Math.floor(Number(stats.attack || 0) * multiplier),
    defense: Math.floor(Number(stats.defense || 0) * multiplier),
    maxHp: Math.floor(Number(stats.maxHp || 0) * multiplier),
    dodge: Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
    crit: Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
  };
}

function getCleanItemName(baseName = "Unknown Item", quality = "Common") {
  const cleanBaseName = String(baseName || "Unknown Item").replace(
    /^(Common|Rare|Legendary|Starter)\s+/i,
    ""
  );

  if (quality === "Starter") {
    return cleanBaseName;
  }

  return `${quality} ${cleanBaseName}`;
}

function rebalanceItemStats(item = {}) {
  if (!item) return null;

  const quality = getQuality(item);

  if (isStarterItem(item)) {
    return {
      ...item,

      quality: "Starter",
      qualityEmoji: "🌱",

      price: 0,
      source: "starter",
      isStarter: true,

      quantity: Math.max(1, Number(item.quantity || 1)),

      stats: getDefaultStats(),
    };
  }

  if (isConsumable(item)) {
    return {
      ...item,

      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),

      quantity: Math.max(1, Number(item.quantity || 1)),

      stats: item.stats || getDefaultStats(),

      healPercent: Number(item.healPercent || 0),
      healAmount: Number(item.healAmount || item.heal || 0),
    };
  }

  const baseItem = findBaseShopItem(item);

  if (!baseItem) {
    return {
      ...item,

      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),

      quantity: Math.max(1, Number(item.quantity || 1)),

      stats: {
        attack: Number(item.stats?.attack || 0),
        defense: Number(item.stats?.defense || 0),
        maxHp: Number(item.stats?.maxHp || 0),
        dodge: Number(item.stats?.dodge || 0),
        crit: Number(item.stats?.crit || 0),
      },
    };
  }

  const multiplier = getDeterministicMultiplier(item, quality);
  const rebalancedStats = scaleStats(
    baseItem.stats || getDefaultStats(),
    multiplier
  );

  const priceMultiplier = getPriceMultiplierBySource(item, quality);

  return {
    ...item,

    id: item.id || baseItem.id,
    baseItemId: baseItem.id,

    name: getCleanItemName(baseItem.name, quality),
    type: baseItem.type || item.type || "Unknown",

    quality,
    qualityEmoji: getQualityEmoji(quality),

    requiredLevel: Number(baseItem.requiredLevel || item.requiredLevel || 1),
    compatibleClasses:
      baseItem.compatibleClasses || item.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || item.price || 0) * priceMultiplier
    ),

    description: baseItem.description || item.description || "",

    stats: rebalancedStats,

    emoji: baseItem.emoji || item.emoji || "📦",

    quantity: Math.max(1, Number(item.quantity || 1)),
  };
}

function normalizeStarterWeapon(player) {
  const classId = player.classId || "swordsman";
  const starterWeapon = getStarterWeaponByClass(classId);

  const currentWeapon = player.equipment?.weapon;

  if (currentWeapon && !isStarterItem(currentWeapon)) {
    return rebalanceItemStats(currentWeapon);
  }

  return {
    id: `${classId}_starter_weapon`,
    baseItemId: `${classId}_starter_weapon`,
    name: starterWeapon.name,
    type: "Weapon",
    quality: "Starter",
    qualityEmoji: "🌱",
    requiredLevel: 1,
    compatibleClasses: [classId],
    price: 0,
    description: "Starter weapon.",
    source: "starter",
    isStarter: true,
    quantity: 1,

    stats: getDefaultStats(),

    emoji: starterWeapon.emoji,
  };
}

function normalizeEquipment(player = {}) {
  const equipment = {
    ...getDefaultEquipment(),
    ...(player.equipment || {}),
  };

  return {
    weapon: normalizeStarterWeapon(player),
    helmet: equipment.helmet ? rebalanceItemStats(equipment.helmet) : null,
    armor: equipment.armor ? rebalanceItemStats(equipment.armor) : null,
    gloves: equipment.gloves ? rebalanceItemStats(equipment.gloves) : null,
    pants: equipment.pants ? rebalanceItemStats(equipment.pants) : null,
    boots: equipment.boots ? rebalanceItemStats(equipment.boots) : null,
  };
}

function normalizeInventory(inventory = []) {
  if (!Array.isArray(inventory)) return [];

  return inventory
    .filter(Boolean)
    .map((item) => rebalanceItemStats(item))
    .filter(Boolean);
}

function recalculatePlayerStats(player = {}, targetLevel = null) {
  const level = Number(targetLevel || player.level || 1);
  const classId = player.classId || "swordsman";

  const baseStats = getBaseStatsByClassLevel(classId, level);

  const equipment = normalizeEquipment({
    ...player,
    classId,
  });

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

function getHpAfterRebalance(player, oldMaxHp, newMaxHp) {
  const oldHp = Number(player.hp ?? oldMaxHp ?? newMaxHp);

  if (oldHp <= 0) return 0;

  const safeOldMaxHp = Math.max(1, Number(oldMaxHp || newMaxHp || 100));
  const hpPercent = oldHp / safeOldMaxHp;

  return Math.max(
    1,
    Math.min(newMaxHp, Math.floor(Number(newMaxHp || 100) * hpPercent))
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

      const oldStats = {
        hp: Number(player.hp || 0),
        maxHp: Number(player.maxHp || 0),
        attack: Number(player.attack || 0),
        defense: Number(player.defense || 0),
        dodge: Number(player.dodge || 0),
        crit: Number(player.crit || 0),
      };

      const inventory = normalizeInventory(player.inventory || []);
      const recalculated = recalculatePlayerStats(player);

      const repairedHp = getHpAfterRebalance(
        player,
        oldStats.maxHp,
        recalculated.totalStats.maxHp
      );

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
        oldStats,
        repairedHp,
        totalStats: recalculated.totalStats,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Repair player failed.");
    }

    return message.reply(
      `✅ Repaired and rebalanced player data for **${
        result.player.username || target.username
      }**.\n\n` +
        `📉 **Old Stats**\n` +
        `❤️ HP: **${result.oldStats.hp}/${result.oldStats.maxHp}**\n` +
        `⚔️ ATK: **${result.oldStats.attack}**\n` +
        `🛡️ DEF: **${result.oldStats.defense}**\n` +
        `💨 Dodge: **${result.oldStats.dodge}%**\n` +
        `💥 Crit: **${result.oldStats.crit}%**\n\n` +
        `📊 **New Stats**\n` +
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