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
  const quality = String(item.quality || "Common");

  if (["Starter", "Common", "Rare", "Legendary"].includes(quality)) {
    return quality;
  }

  return "Common";
}

function getSource(item = {}) {
  return String(item.source || "shop").toLowerCase();
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
    .sort((a, b) => normalizeId(b.id).length - normalizeId(a.id).length);

  return prefixMatches[0] || null;
}

function getRollConfigBySource(item = {}, quality = "Common") {
  const source = getSource(item);

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

  const source = getSource(item);

  if (!source || source === "shop") {
    return Number(balanceConfig.quality?.[quality]?.statMultiplier || 1);
  }

  const rollConfig = getRollConfigBySource(item, quality);

  if (rollConfig) {
    const min = Number(rollConfig.min || 1);
    const max = Number(rollConfig.max || min);

    return Number(((min + max) / 2).toFixed(3));
  }

  return Number(balanceConfig.quality?.[quality]?.statMultiplier || 1);
}

function getPriceMultiplierBySource(item = {}, quality = "Common") {
  const source = getSource(item);

  if (source === "boss_raid") {
    return Number(balanceConfig.bossDrop?.priceMultiplier?.[quality] || 1);
  }

  if (source === "monster_drop") {
    return Number(balanceConfig.monsterDrop?.priceMultiplier?.[quality] || 1);
  }

  if (source === "admin_generated" || source === "admin") {
    return Number(
      balanceConfig.adminItem?.priceMultiplier?.[quality] ||
        balanceConfig.quality?.[quality]?.priceMultiplier ||
        1
    );
  }

  return Number(balanceConfig.quality?.[quality]?.priceMultiplier || 1);
}

function capPercentStat(statName, value, quality = "Common", source = "shop") {
  const statValue = Number(value || 0);

  if (typeof balanceConfig.capItemPercentStat === "function") {
    return balanceConfig.capItemPercentStat(
      statName,
      statValue,
      quality,
      source
    );
  }

  let cap = Number(balanceConfig.item?.statCaps?.[statName] || 0);

  if (source === "monster_drop") {
    cap = Number(
      balanceConfig.monsterDrop?.statCaps?.[quality]?.[statName] || cap
    );
  }

  if (source === "boss_raid") {
    cap = Number(
      balanceConfig.bossDrop?.statCaps?.[quality]?.[statName] || cap
    );
  }

  if (source === "admin_generated" || source === "admin") {
    if (quality === "Rare") {
      cap = Number(
        balanceConfig.monsterDrop?.statCaps?.Rare?.[statName] || cap
      );
    }

    if (quality === "Legendary") {
      cap = Number(
        balanceConfig.bossDrop?.statCaps?.Legendary?.[statName] || cap
      );
    }
  }

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function scaleStats(
  stats = {},
  multiplier = 1,
  quality = "Common",
  source = "shop"
) {
  return {
    attack: Math.floor(Number(stats.attack || 0) * multiplier),
    defense: Math.floor(Number(stats.defense || 0) * multiplier),
    maxHp: Math.floor(Number(stats.maxHp || 0) * multiplier),

    dodge: capPercentStat(
      "dodge",
      Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
      quality,
      source
    ),

    crit: capPercentStat(
      "crit",
      Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
      quality,
      source
    ),
  };
}

function normalizeFallbackStats(item = {}) {
  const quality = getQuality(item);
  const source = getSource(item);

  return {
    attack: Math.floor(Number(item.stats?.attack || 0)),
    defense: Math.floor(Number(item.stats?.defense || 0)),
    maxHp: Math.floor(Number(item.stats?.maxHp || 0)),

    dodge: capPercentStat(
      "dodge",
      Number(item.stats?.dodge || 0),
      quality,
      source
    ),

    crit: capPercentStat(
      "crit",
      Number(item.stats?.crit || 0),
      quality,
      source
    ),
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

function makeDescription(stats = {}) {
  const parts = [];

  if (stats.attack) parts.push(`+${stats.attack} ATK`);
  if (stats.defense) parts.push(`+${stats.defense} DEF`);
  if (stats.maxHp) parts.push(`+${stats.maxHp} HP`);
  if (stats.dodge) parts.push(`+${stats.dodge}% Dodge`);
  if (stats.crit) parts.push(`+${stats.crit}% Crit`);

  return parts.length ? parts.join(", ") : "No bonus stats";
}

function rebalanceItemStats(item = {}) {
  if (!item) return null;

  const quality = getQuality(item);
  const source = getSource(item);
  const baseItem = findBaseShopItem(item);

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
      description: item.description || "Starter weapon.",
    };
  }

  if (isConsumable(item)) {
    const sourceItem = baseItem || item;

    return {
      ...item,

      id: item.id || sourceItem.id,
      baseItemId: sourceItem.baseItemId || sourceItem.id || item.baseItemId,

      name: sourceItem.name || item.name || "Unknown Consumable",
      type: sourceItem.type || item.type || "Consumable",

      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),

      requiredLevel: Number(sourceItem.requiredLevel || item.requiredLevel || 1),
      compatibleClasses:
        sourceItem.compatibleClasses || item.compatibleClasses || ["all"],

      price: Math.max(
        0,
        Math.floor(Number(sourceItem.price || item.price || 0))
      ),

      description:
        sourceItem.description || item.description || "Consumable item.",

      quantity: Math.max(1, Number(item.quantity || 1)),

      stats: getDefaultStats(),

      healPercent: Number(sourceItem.healPercent || item.healPercent || 0),
      healAmount: Number(
        sourceItem.healAmount ||
          sourceItem.heal ||
          item.healAmount ||
          item.heal ||
          0
      ),

      source: item.source || "shop",
      emoji: sourceItem.emoji || item.emoji || "🧪",
    };
  }

  if (!baseItem) {
    const fallbackStats = normalizeFallbackStats(item);

    return {
      ...item,

      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),

      quantity: Math.max(1, Number(item.quantity || 1)),

      stats: fallbackStats,
      description: makeDescription(fallbackStats),
    };
  }

  const multiplier = getDeterministicMultiplier(item, quality);

  const rebalancedStats = scaleStats(
    baseItem.stats || getDefaultStats(),
    multiplier,
    quality,
    source
  );

  const priceMultiplier = getPriceMultiplierBySource(item, quality);

  return {
    ...item,

    id: item.id || baseItem.id,
    baseItemId: baseItem.id,

    name:
      source === "shop"
        ? baseItem.name
        : getCleanItemName(baseItem.name, quality),

    type: baseItem.type || item.type || "Unknown",

    quality,
    qualityEmoji: getQualityEmoji(quality),

    requiredLevel: Number(baseItem.requiredLevel || item.requiredLevel || 1),
    compatibleClasses:
      baseItem.compatibleClasses || item.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || item.price || 0) * priceMultiplier
    ),

    description: makeDescription(rebalancedStats),
    stats: rebalancedStats,

    emoji: baseItem.emoji || item.emoji || "📦",

    quantity: Math.max(1, Number(item.quantity || 1)),
    source,
  };
}

function getStarterWeaponItem(classId = "swordsman") {
  const starterWeapon = getStarterWeaponByClass(classId);

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

function normalizeStarterWeapon(player) {
  const classId = player.classId || "swordsman";
  const currentWeapon = player.equipment?.weapon;

  if (currentWeapon && !isStarterItem(currentWeapon)) {
    return {
      ...rebalanceItemStats(currentWeapon),
      quantity: 1,
    };
  }

  return getStarterWeaponItem(classId);
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
  const level = Math.max(
    1,
    Math.min(getMaxLevel(), Number(targetLevel || player.level || 1))
  );

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
  const safeInventory = Array.isArray(inventory) ? inventory : [];

  const totalQuantity = safeInventory.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );

  return {
    stacks: safeInventory.length,
    totalQuantity,

    starter: safeInventory.filter((item) => item.quality === "Starter").length,
    common: safeInventory.filter((item) => item.quality === "Common").length,
    rare: safeInventory.filter((item) => item.quality === "Rare").length,
    legendary: safeInventory.filter((item) => item.quality === "Legendary")
      .length,
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
      const oldGold = Math.max(0, Number(player.gold || 0));
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
      const inventory = normalizeInventory(player.inventory || []);

      transaction.update(playerRef, {
        level,
        exp: 0,

        baseStats: recalculated.baseStats,
        equipment: recalculated.equipment,
        inventory,

        attack: recalculated.totalStats.attack,
        defense: recalculated.totalStats.defense,
        maxHp: recalculated.totalStats.maxHp,
        dodge: recalculated.totalStats.dodge,
        crit: recalculated.totalStats.crit,
        hp: recalculated.totalStats.maxHp,

        weapon:
          recalculated.equipment.weapon?.name ||
          getStarterWeaponByClass(recalculated.classId).name,

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
      const recalculated = recalculatePlayerStats(player);
      const inventory = normalizeInventory(player.inventory || []);

      transaction.update(playerRef, {
        baseStats: recalculated.baseStats,
        equipment: recalculated.equipment,
        inventory,

        attack: recalculated.totalStats.attack,
        defense: recalculated.totalStats.defense,
        maxHp: recalculated.totalStats.maxHp,
        dodge: recalculated.totalStats.dodge,
        crit: recalculated.totalStats.crit,
        hp: recalculated.totalStats.maxHp,

        weapon:
          recalculated.equipment.weapon?.name ||
          getStarterWeaponByClass(recalculated.classId).name,

        updatedAt: new Date(),
      });

      return {
        ok: true,
        player,
        maxHp: recalculated.totalStats.maxHp,
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
      const recalculated = recalculatePlayerStats(player);
      const inventory = normalizeInventory(player.inventory || []);

      const maxHp = recalculated.totalStats.maxHp;
      const reviveHp = getAdminReviveHp(maxHp);

      transaction.update(playerRef, {
        baseStats: recalculated.baseStats,
        equipment: recalculated.equipment,
        inventory,

        attack: recalculated.totalStats.attack,
        defense: recalculated.totalStats.defense,
        maxHp: recalculated.totalStats.maxHp,
        dodge: recalculated.totalStats.dodge,
        crit: recalculated.totalStats.crit,
        hp: reviveHp,

        weapon:
          recalculated.equipment.weapon?.name ||
          getStarterWeaponByClass(recalculated.classId).name,

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
    const inventory = normalizeInventory(player.inventory || []);
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
    return message.reply(
      "⚠️ `repairplayer` is now handled by `adminMaintenance.js`.\n\n" +
        "Make sure your `admin.js` routes `repairplayer` to `adminMaintenance`, not `adminPlayer`."
    );
  }

  return message.reply(
    "❌ Unknown player admin command.\n\n" +
      "Available:\n" +
      "`!s admin givegold @player <amount>`\n" +
      "`!s admin setlevel @player <1-99>`\n" +
      "`!s admin heal @player`\n" +
      "`!s admin revive @player`\n" +
      "`!s admin inventory @player`\n\n" +
      "Maintenance:\n" +
      "`!s admin repairplayer @player`"
  );
};