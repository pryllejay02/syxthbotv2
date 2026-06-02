const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");

const EQUIPMENT_SLOTS = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "pants",
  "boots",
];

function getSlot(type) {
  const itemType = String(type || "").toLowerCase();

  if (itemType === "weapon") return "weapon";
  if (itemType === "helmet") return "helmet";
  if (itemType === "armor") return "armor";
  if (itemType === "gloves") return "gloves";
  if (itemType === "pants") return "pants";
  if (itemType === "boots") return "boots";

  return null;
}

function canUseItem(player, item) {
  const compatibleClasses = Array.isArray(item.compatibleClasses)
    ? item.compatibleClasses
    : ["all"];

  if (compatibleClasses.includes("all")) return true;

  return compatibleClasses.includes(player.classId || "swordsman");
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

function getDefaultStats() {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
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
  const attack = Math.floor(Number(stats.attack || 0) * multiplier);
  const defense = Math.floor(Number(stats.defense || 0) * multiplier);
  const maxHp = Math.floor(Number(stats.maxHp || 0) * multiplier);

  const dodge = capPercentStat(
    "dodge",
    Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
    quality,
    source
  );

  const crit = capPercentStat(
    "crit",
    Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
    quality,
    source
  );

  return {
    attack,
    defense,
    maxHp,
    dodge,
    crit,
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

      price: Math.max(0, Math.floor(Number(sourceItem.price || item.price || 0))),

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

function getBaseStats(player) {
  if (typeof balanceConfig.getBaseStatsByClassLevel === "function") {
    return balanceConfig.getBaseStatsByClassLevel(
      player.classId || "swordsman",
      Number(player.level || 1)
    );
  }

  return {
    attack: Number(player.baseStats?.attack || 10),
    defense: Number(player.baseStats?.defense || 5),
    maxHp: Number(player.baseStats?.maxHp || 100),
    dodge: Number(player.baseStats?.dodge || 0),
    crit: Number(player.baseStats?.crit || 0),
  };
}

function shouldReturnOldItemToInventory(item) {
  if (!item) return false;
  if (isStarterItem(item)) return false;
  if (isConsumable(item)) return false;

  return true;
}

function addReturnedItemToInventory(inventory = [], item = {}) {
  const normalizedItem = rebalanceItemStats(item);

  if (!normalizedItem) return inventory;

  const returnedItem = {
    ...normalizedItem,
    equipped: false,
    isEquipped: false,
    quantity: 1,
  };

  const existingOldItemIndex = inventory.findIndex(
    (invItem) =>
      normalizeId(invItem.baseItemId || invItem.id) ===
        normalizeId(returnedItem.baseItemId || returnedItem.id) &&
      invItem.quality === returnedItem.quality &&
      invItem.source === returnedItem.source &&
      JSON.stringify(invItem.stats || {}) ===
        JSON.stringify(returnedItem.stats || {})
  );

  if (existingOldItemIndex !== -1) {
    inventory[existingOldItemIndex].equipped = false;
    inventory[existingOldItemIndex].isEquipped = false;
    inventory[existingOldItemIndex].quantity =
      Number(inventory[existingOldItemIndex].quantity || 0) + 1;
  } else {
    inventory.push(returnedItem);
  }

  return inventory;
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

function removeOneInventoryItem(inventory = [], itemIndex) {
  const currentItem = inventory[itemIndex];

  if (!currentItem) return inventory;

  const quantity = Number(currentItem.quantity || 1);

  if (quantity > 1) {
    inventory[itemIndex] = {
      ...currentItem,
      quantity: quantity - 1,
      equipped: false,
      isEquipped: false,
    };
  } else {
    inventory.splice(itemIndex, 1);
  }

  return inventory;
}

function buildEquippedItem(item = {}) {
  const rebalancedItem = rebalanceItemStats(item);

  return {
    id: rebalancedItem.id,
    baseItemId: rebalancedItem.baseItemId || rebalancedItem.id,
    name: rebalancedItem.name,
    type: rebalancedItem.type,
    quality: rebalancedItem.quality || "Common",
    qualityEmoji:
      rebalancedItem.quality === "Starter"
        ? "🌱"
        : getQualityEmoji(rebalancedItem.quality || "Common"),
    requiredLevel: Number(rebalancedItem.requiredLevel || 1),
    compatibleClasses: rebalancedItem.compatibleClasses || ["all"],
    stats: rebalancedItem.stats || getDefaultStats(),
    price: Number(rebalancedItem.price || 0),
    description: rebalancedItem.description || "",
    source: rebalancedItem.source || "unknown",
    emoji: rebalancedItem.emoji || "📦",
    quantity: 1,
  };
}

function getHpAfterEquip(player, oldTotalStats, newTotalStats) {
  const currentHp = Number(player.hp ?? oldTotalStats.maxHp);
  const oldMaxHp = Number(oldTotalStats.maxHp || 100);
  const newMaxHp = Number(newTotalStats.maxHp || 100);

  if (currentHp <= 0) return 0;

  const hpDifference = newMaxHp - oldMaxHp;

  return Math.min(newMaxHp, currentHp + Math.max(0, hpDifference));
}

module.exports = async function equipCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const itemId = args[0];

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID.\n\nExample: `!s equip archer_iron_weapon`"
    );
  }

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "You don’t have a character yet. Use `!s start` first.",
      };
    }

    const player = playerDoc.data();
    const classId = player.classId || "swordsman";

    const inventory = normalizeInventory(player.inventory || []);
    const itemIndex = findInventoryItemIndex(inventory, itemId);

    if (itemIndex === -1) {
      return {
        ok: false,
        message: "❌ You don’t have that item in your inventory.",
      };
    }

    const item = rebalanceItemStats(inventory[itemIndex]);

    if (isConsumable(item)) {
      return {
        ok: false,
        message:
          "❌ Consumables cannot be equipped. Use `!s use <item_id>` instead.",
      };
    }

    const slot = getSlot(item.type);
    const qualityEmoji =
      item.quality === "Starter"
        ? "🌱"
        : getQualityEmoji(item.quality || "Common");

    if (!slot) {
      return {
        ok: false,
        message: "❌ This item cannot be equipped.",
      };
    }

    if (!canUseItem({ ...player, classId }, item)) {
      return {
        ok: false,
        message:
          `❌ This item is not compatible with your class.\n\n` +
          `Your Class: **${player.class || "Unknown"}**`,
      };
    }

    const playerLevel = Number(player.level || 1);
    const requiredLevel = Number(item.requiredLevel || 1);

    if (playerLevel < requiredLevel) {
      return {
        ok: false,
        message:
          `🔒 You cannot equip this item yet.\n\n` +
          `Required Level: **Lv.${requiredLevel}**\n` +
          `Your Level: **Lv.${playerLevel}**`,
      };
    }

    const equipment = normalizeEquipment({
      ...player,
      classId,
    });

    const baseStats = getBaseStats({
      ...player,
      classId,
    });

    const oldTotalStats = calculateTotalStats(baseStats, equipment);
    const oldEquippedItem = equipment[slot];

    removeOneInventoryItem(inventory, itemIndex);

    if (shouldReturnOldItemToInventory(oldEquippedItem)) {
      addReturnedItemToInventory(inventory, oldEquippedItem);
    }

    equipment[slot] = buildEquippedItem(item);

    const totalStats = calculateTotalStats(baseStats, equipment);
    const newHp = getHpAfterEquip(player, oldTotalStats, totalStats);

    transaction.update(playerRef, {
      baseStats,
      equipment,
      inventory,

      attack: totalStats.attack,
      defense: totalStats.defense,
      maxHp: totalStats.maxHp,
      dodge: totalStats.dodge,
      crit: totalStats.crit,
      hp: newHp,

      weapon: equipment.weapon?.name || getStarterWeaponByClass(classId).name,

      updatedAt: new Date(),
    });

    return {
      ok: true,
      item: equipment[slot],
      slot,
      qualityEmoji,
      totalStats,
      newHp,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Equip failed.");
  }

  return message.reply(
    `${result.item.emoji || "📦"} Equipped **${result.item.name}**!\n\n` +
      `Slot: **${result.slot.toUpperCase()}**\n` +
      `Quality: **${result.qualityEmoji} ${result.item.quality || "Common"}**\n` +
      `📊 Item Stats: **${result.item.description || "No bonus stats"}**\n\n` +
      `❤️ HP: ${result.newHp}/${result.totalStats.maxHp}\n` +
      `⚔️ Attack: ${result.totalStats.attack}\n` +
      `🛡️ Defense: ${result.totalStats.defense}\n` +
      `💨 Dodge: ${Number(result.totalStats.dodge || 0).toFixed(1)}%\n` +
      `💥 Crit: ${Number(result.totalStats.crit || 0).toFixed(1)}%`
  );
};