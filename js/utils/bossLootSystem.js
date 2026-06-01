const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("./qualitySystem");
const balanceConfig = require("../data/balanceConfig");

function getNearestItemLevel(bossLevel) {
  if (typeof balanceConfig.getNearestItemLevel === "function") {
    return balanceConfig.getNearestItemLevel(bossLevel);
  }

  const level = Number(bossLevel || 1);

  const itemLevels =
    balanceConfig.bossDrop?.itemLevels ||
    balanceConfig.item?.levels?.map(([itemLevel]) => itemLevel) ||
    balanceConfig.ITEM_LEVELS?.map(([itemLevel]) => itemLevel) ||
    [];

  if (!itemLevels.length) {
    return level;
  }

  let nearest = Number(itemLevels[0] || 1);

  for (const itemLevel of itemLevels) {
    if (Number(itemLevel) <= level) {
      nearest = Number(itemLevel);
    }
  }

  return nearest;
}

function scaleStatsByQuality(stats = {}, quality = "Rare") {
  const rollConfig =
    balanceConfig.bossDrop?.statRolls?.[quality] ||
    balanceConfig.bossDrop?.statRolls?.Rare ||
    {
      min: 1.35,
      max: 1.65,
    };

  const multiplier =
    typeof balanceConfig.randomBetween === "function"
      ? balanceConfig.randomBetween(rollConfig.min, rollConfig.max)
      : Math.random() *
          (Number(rollConfig.max || 1) - Number(rollConfig.min || 1)) +
        Number(rollConfig.min || 1);

  return {
    attack: Math.floor(Number(stats.attack || 0) * multiplier),
    defense: Math.floor(Number(stats.defense || 0) * multiplier),
    maxHp: Math.floor(Number(stats.maxHp || 0) * multiplier),
    dodge: Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
    crit: Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
  };
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

function getPriceMultiplier(quality = "Rare") {
  return Number(balanceConfig.bossDrop?.priceMultiplier?.[quality] || 1);
}

function cleanItemName(name, quality) {
  const baseName = String(name || "Unknown Item").replace(/^Common /, "");

  return `${quality} ${baseName}`;
}

function generateBossDrop(bossLevel, quality = "Rare") {
  const itemLevel = getNearestItemLevel(bossLevel);

  const possibleItems = shopItems.filter(
    (item) =>
      String(item.type || "").toLowerCase() !== "consumable" &&
      Number(item.requiredLevel || 1) === itemLevel
  );

  if (possibleItems.length === 0) {
    return null;
  }

  const baseItem =
    possibleItems[Math.floor(Math.random() * possibleItems.length)];

  const stats = scaleStatsByQuality(baseItem.stats || {}, quality);
  const qualityEmoji = getQualityEmoji(quality);

  return {
    ...baseItem,

    id: `${baseItem.id}_${quality.toLowerCase()}_boss_${Date.now()}_${Math.floor(
      Math.random() * 99999
    )}`,

    baseItemId: baseItem.baseItemId || baseItem.id,
    name: cleanItemName(baseItem.name, quality),

    quality,
    qualityEmoji,

    requiredLevel: itemLevel,
    compatibleClasses: baseItem.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || 0) * getPriceMultiplier(quality)
    ),

    description: makeDescription(stats),
    stats,

    quantity: 1,
    source: "boss_raid",
    emoji: baseItem.emoji || "📦",
  };
}

function addItemToInventory(inventory = [], droppedItem) {
  if (!droppedItem) return inventory;

  const existingItemIndex = inventory.findIndex(
    (item) =>
      item.baseItemId === droppedItem.baseItemId &&
      item.quality === droppedItem.quality &&
      JSON.stringify(item.stats || {}) ===
        JSON.stringify(droppedItem.stats || {})
  );

  if (existingItemIndex !== -1) {
    inventory[existingItemIndex].quantity =
      Number(inventory[existingItemIndex].quantity || 1) + 1;
  } else {
    inventory.push({
      ...droppedItem,
      quantity: 1,
    });
  }

  return inventory;
}

module.exports = {
  generateBossDrop,
  addItemToInventory,
};