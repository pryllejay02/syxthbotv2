const { db } = require("../../firebase/firebase");
const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("../utils/qualitySystem");
const { calculateTotalStats } = require("../utils/statSystem");

const EQUIPMENT_SLOTS = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "pants",
  "boots",
];

function getDefaultStats() {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
    dodge: 0,
    crit: 0,
  };
}

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
      price: Number(sourceItem.price || item.price || 0),
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

function normalizeInventory(inventory = []) {
  if (!Array.isArray(inventory)) return [];

  return inventory
    .filter(Boolean)
    .map((item) => rebalanceItemStats(item))
    .filter(Boolean);
}

function normalizeEquipmentSlot(item) {
  if (!item) return null;

  const normalizedItem = rebalanceItemStats(item);

  if (!normalizedItem) return null;
  if (isConsumable(normalizedItem)) return null;

  return {
    ...normalizedItem,
    quantity: 1,
  };
}

function normalizeEquipment(player = {}) {
  const classId = player.classId || "swordsman";

  const safeEquipment = {
    ...getDefaultEquipment(),
    ...(player.equipment || {}),
  };

  const equipment = getDefaultEquipment();

  EQUIPMENT_SLOTS.forEach((slot) => {
    equipment[slot] = normalizeEquipmentSlot(safeEquipment[slot]);
  });

  if (!equipment.weapon) {
    equipment.weapon = getStarterWeaponItem(classId);
  }

  return equipment;
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

function getRebalancedPlayerData(player = {}) {
  const level = Math.max(1, Number(player.level || 1));
  const classId = player.classId || "swordsman";

  const baseStats = getBaseStatsByClassLevel(classId, level);
  const equipment = normalizeEquipment({
    ...player,
    classId,
  });

  const inventory = normalizeInventory(player.inventory || []);
  const totalStats = calculateTotalStats(baseStats, equipment);

  const hp = Math.min(
    Math.max(0, Number(player.hp ?? totalStats.maxHp)),
    Number(totalStats.maxHp || 100)
  );

  return {
    level,
    classId,
    baseStats,
    equipment,
    inventory,
    totalStats,
    hp,
    maxHp: totalStats.maxHp,
  };
}

function getBaseUpdatePayload(player = {}, rebalanced = {}) {
  const classId = rebalanced.classId || player.classId || "swordsman";

  return {
    level: rebalanced.level,
    classId,
    baseStats: rebalanced.baseStats,
    equipment: rebalanced.equipment,
    maxHp: rebalanced.totalStats.maxHp,
    attack: rebalanced.totalStats.attack,
    defense: rebalanced.totalStats.defense,
    dodge: rebalanced.totalStats.dodge,
    crit: rebalanced.totalStats.crit,
    weapon:
      rebalanced.equipment?.weapon?.name ||
      getStarterWeaponByClass(classId).name,
    updatedAt: new Date(),
  };
}

function getHealAmount(item, maxHp) {
  const healPercent = Number(item.healPercent || 0);
  const healAmount = Number(item.healAmount || item.heal || 0);

  if (healPercent > 0) {
    return Math.max(
      1,
      Math.floor(Number(maxHp || 100) * (healPercent / 100))
    );
  }

  if (healAmount > 0) {
    return Math.floor(healAmount);
  }

  return 0;
}

function findInventoryItemIndex(inventory = [], itemId) {
  const targetId = normalizeId(itemId);

  return inventory.findIndex((item) => {
    if (!item) return false;

    const id = normalizeId(item.id);
    const baseItemId = normalizeId(item.baseItemId);

    return id === targetId || baseItemId === targetId;
  });
}

function removeUsedItemFromInventory(inventory, itemIndex) {
  const item = inventory[itemIndex];
  const quantity = Number(item.quantity || 1);

  if (quantity > 1) {
    inventory[itemIndex] = {
      ...item,
      quantity: quantity - 1,
    };
  } else {
    inventory.splice(itemIndex, 1);
  }

  return inventory;
}

module.exports = async function useCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);
  const battleRef = db.collection("battles").doc(userId);

  const itemId = String(args[0] || "").toLowerCase();

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item.\n\nExample: `!s use hp_potion`"
    );
  }

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    const battleDoc = await transaction.get(battleRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "You don’t have a character yet. Use `!s start` first.",
      };
    }

    const player = playerDoc.data();
    const rebalanced = getRebalancedPlayerData(player);

    const inventory = [...rebalanced.inventory];
    const itemIndex = findInventoryItemIndex(inventory, itemId);

    const hp = Number(rebalanced.hp || 0);
    const maxHp = Number(rebalanced.maxHp || 100);
    const baseUpdate = getBaseUpdatePayload(player, rebalanced);

    if (itemIndex === -1) {
      transaction.update(playerRef, {
        ...baseUpdate,
        hp,
        inventory,
      });

      return {
        ok: false,
        message: "❌ You don’t have that item in your inventory.",
      };
    }

    const item = rebalanceItemStats(inventory[itemIndex]);

    if (!isConsumable(item)) {
      transaction.update(playerRef, {
        ...baseUpdate,
        hp,
        inventory,
      });

      return {
        ok: false,
        message: "❌ This item is not consumable.",
      };
    }

    if (hp <= 0) {
      transaction.update(playerRef, {
        ...baseUpdate,
        hp: 0,
        inventory,
      });

      return {
        ok: false,
        message:
          "💀 You cannot use consumables while defeated. Use `!s rest` or wait for revival.",
      };
    }

    if (hp >= maxHp) {
      transaction.update(playerRef, {
        ...baseUpdate,
        hp: maxHp,
        inventory,
      });

      return {
        ok: false,
        message: "❤️ Your HP is already full.",
      };
    }

    const healAmount = getHealAmount(item, maxHp);

    if (healAmount <= 0) {
      transaction.update(playerRef, {
        ...baseUpdate,
        hp,
        inventory,
      });

      return {
        ok: false,
        message: "❌ This consumable item has no effect yet.",
      };
    }

    const newHp = Math.min(maxHp, hp + healAmount);
    const actualHealed = newHp - hp;
    const oldQuantity = Number(item.quantity || 1);

    removeUsedItemFromInventory(inventory, itemIndex);

    transaction.update(playerRef, {
      ...baseUpdate,
      hp: newHp,
      inventory,
    });

    if (battleDoc.exists) {
      transaction.update(battleRef, {
        updatedAt: new Date(),
      });
    }

    return {
      ok: true,
      item,
      oldHp: hp,
      newHp,
      maxHp,
      actualHealed,
      remainingQuantity: oldQuantity > 1 ? oldQuantity - 1 : 0,
      inBattle: battleDoc.exists,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Item use failed.");
  }

  return message.reply(
    `${result.item.emoji || "🧪"} You used **${result.item.name}**!\n\n` +
      `❤️ HP Restored: **${result.actualHealed}**\n` +
      `❤️ Current HP: **${result.oldHp} → ${result.newHp}/${result.maxHp}**\n` +
      `📦 Remaining: **${result.remainingQuantity}**\n\n` +
      `${
        result.inBattle
          ? "⚔️ You are still in battle. Use `!s hit` or `!s retreat`."
          : "✅ Item consumed."
      }`
  );
};