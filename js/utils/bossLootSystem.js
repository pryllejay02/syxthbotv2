const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("./qualitySystem");

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function getNearestItemLevel(bossLevel) {
  const itemLevels = [
    5, 10, 15, 20, 25, 30, 35, 40, 45,
    50, 55, 60, 65, 70, 75, 80, 85, 90,
  ];

  const level = Number(bossLevel || 1);

  let nearest = itemLevels[0];

  for (const itemLevel of itemLevels) {
    if (itemLevel <= level) {
      nearest = itemLevel;
    }
  }

  return nearest;
}

function scaleStatsByQuality(stats, quality) {
  const multiplier =
    quality === "Legendary"
      ? randomBetween(2.1, 2.8)
      : quality === "Rare"
      ? randomBetween(1.35, 1.75)
      : randomBetween(1.0, 1.15);

  return {
    attack: Math.floor((stats.attack || 0) * multiplier),
    defense: Math.floor((stats.defense || 0) * multiplier),
    maxHp: Math.floor((stats.maxHp || 0) * multiplier),
    dodge: Number(((stats.dodge || 0) * multiplier).toFixed(1)),
    crit: Number(((stats.crit || 0) * multiplier).toFixed(1)),
  };
}

function makeDescription(stats) {
  const parts = [];

  if (stats.attack) parts.push(`+${stats.attack} ATK`);
  if (stats.defense) parts.push(`+${stats.defense} DEF`);
  if (stats.maxHp) parts.push(`+${stats.maxHp} HP`);
  if (stats.dodge) parts.push(`+${stats.dodge}% Dodge`);
  if (stats.crit) parts.push(`+${stats.crit}% Crit`);

  return parts.join(", ");
}

function generateBossDrop(bossLevel, quality) {
  const itemLevel = getNearestItemLevel(bossLevel);

  const possibleItems = shopItems.filter(
    (item) =>
      item.type !== "Consumable" &&
      Number(item.requiredLevel || 1) === itemLevel
  );

  if (possibleItems.length === 0) return null;

  const baseItem =
    possibleItems[Math.floor(Math.random() * possibleItems.length)];

  const stats = scaleStatsByQuality(baseItem.stats || {}, quality);
  const qualityEmoji = getQualityEmoji(quality);

  return {
    ...baseItem,

    id: `${baseItem.id}_${quality.toLowerCase()}_boss_${Date.now()}_${Math.floor(
      Math.random() * 99999
    )}`,

    baseItemId: baseItem.id,
    name: baseItem.name.replace(/^Common /, `${quality} `),

    quality,
    qualityEmoji,

    requiredLevel: itemLevel,
    compatibleClasses: baseItem.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || 0) *
        (quality === "Legendary" ? 5 : quality === "Rare" ? 2 : 1)
    ),

    description: makeDescription(stats),
    stats,
    quantity: 1,
    source: "boss_raid",
  };
}

function addItemToInventory(inventory, droppedItem) {
  if (!droppedItem) return inventory;

  const existingItemIndex = inventory.findIndex(
    (item) =>
      item.baseItemId === droppedItem.baseItemId &&
      item.quality === droppedItem.quality &&
      JSON.stringify(item.stats) === JSON.stringify(droppedItem.stats)
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