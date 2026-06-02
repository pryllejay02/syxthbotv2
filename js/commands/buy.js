const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");

const MAX_BUY_QUANTITY = Number(balanceConfig.shop?.maxBuyQuantity || 99);

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
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

function canUseItem(player, item) {
  const compatibleClasses = Array.isArray(item.compatibleClasses)
    ? item.compatibleClasses
    : ["all"];

  if (compatibleClasses.includes("all")) return true;

  return compatibleClasses.includes(player.classId);
}

function parseBuyQuantity(value) {
  const quantity = Number(value || 1);

  if (!Number.isInteger(quantity)) return null;
  if (quantity <= 0) return null;
  if (quantity > MAX_BUY_QUANTITY) return null;

  return quantity;
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

function normalizeShopItem(item = {}) {
  const normalizedItem = rebalanceItemStats({
    ...item,
    source: item.source || "shop",
    quality: item.quality || "Common",
    quantity: 1,
  });

  return normalizedItem;
}

function buildPurchasedItem(item, quantity) {
  const normalizedItem = normalizeShopItem(item);

  return {
    ...normalizedItem,
    quantity,
    source: "shop",
  };
}

function findExistingInventoryIndex(inventory = [], itemData = {}) {
  const consumable = isConsumable(itemData);

  return inventory.findIndex((invItem) => {
    if (!invItem) return false;

    if (consumable) {
      return normalizeId(invItem.id) === normalizeId(itemData.id);
    }

    return (
      normalizeId(invItem.baseItemId) === normalizeId(itemData.baseItemId) &&
      invItem.quality === itemData.quality &&
      JSON.stringify(invItem.stats || {}) === JSON.stringify(itemData.stats || {})
    );
  });
}

function findShopItemById(itemId) {
  const targetId = normalizeId(itemId);

  return shopItems.find((shopItem) => {
    if (!shopItem) return false;

    const id = normalizeId(shopItem.id);
    const baseItemId = normalizeId(shopItem.baseItemId);

    return id === targetId || baseItemId === targetId;
  });
}

module.exports = async function buyCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const itemId = normalizeId(args[0]);
  const quantity = parseBuyQuantity(args[1]);

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID.\n\nExample: `!s buy archer_iron_weapon 1`"
    );
  }

  if (!quantity) {
    return message.reply(
      `❌ Invalid quantity.\n\n` +
        `Quantity must be a whole number from **1** to **${MAX_BUY_QUANTITY}**.`
    );
  }

  const rawItem = findShopItemById(itemId);

  if (!rawItem) {
    return message.reply("❌ Item not found in the shop.");
  }

  const item = normalizeShopItem(rawItem);

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "You don’t have a character yet. Use `!s start` first.",
      };
    }

    const player = playerDoc.data();

    if (!canUseItem(player, item)) {
      return {
        ok: false,
        message:
          `❌ This item is not compatible with your class.\n\n` +
          `Your Class: **${player.class || "Unknown"}**`,
      };
    }

    const playerLevel = Number(player.level ?? 1);
    const requiredLevel = Number(item.requiredLevel ?? 1);

    if (playerLevel < requiredLevel) {
      return {
        ok: false,
        message:
          `🔒 You cannot buy this item yet.\n\n` +
          `Item Required Level: **Lv.${requiredLevel}**\n` +
          `Your Level: **Lv.${playerLevel}**`,
      };
    }

    const playerGold = Number(player.gold ?? 0);
    const itemPrice = Math.max(0, Math.floor(Number(item.price || 0)));
    const totalCost = itemPrice * quantity;

    if (playerGold < totalCost) {
      return {
        ok: false,
        message:
          `💰 You don't have enough gold.\n\n` +
          `Required: **${totalCost} Gold**\n` +
          `Your Gold: **${playerGold}**`,
      };
    }

    const inventory = normalizeInventory(player.inventory || []);
    const itemData = buildPurchasedItem(item, quantity);

    const existingItemIndex = findExistingInventoryIndex(inventory, itemData);

    if (existingItemIndex !== -1) {
      inventory[existingItemIndex] = {
        ...inventory[existingItemIndex],
        ...itemData,
        quantity:
          Number(inventory[existingItemIndex].quantity || 0) + quantity,
      };
    } else {
      inventory.push(itemData);
    }

    const newGold = playerGold - totalCost;

    transaction.update(playerRef, {
      gold: newGold,
      inventory,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      player,
      totalCost,
      newGold,
      itemData,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Purchase failed.");
  }

  const boughtItem = result.itemData;

  return message.reply(
    `${boughtItem.emoji || "📦"} ${boughtItem.qualityEmoji} You bought **${boughtItem.name} x${quantity}**!\n\n` +
      `🏷️ Quality: **${boughtItem.qualityEmoji} ${boughtItem.quality}**\n` +
      `🎭 Class: **${(boughtItem.compatibleClasses || ["all"]).join(", ")}**\n` +
      `🔓 Required Level: **Lv.${boughtItem.requiredLevel || 1}**\n` +
      `📊 Stats: **${boughtItem.description || "No bonus stats"}**\n` +
      `💰 Gold Spent: **${result.totalCost}**\n` +
      `🪙 Remaining Gold: **${result.newGold}**\n\n` +
      `🎒 Item added to your inventory.`
  );
};