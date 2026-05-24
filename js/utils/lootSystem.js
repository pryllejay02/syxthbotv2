const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("./qualitySystem");

const DROP_RATES = {
  rare: 30,
  common: 50,
  none: 20,
};

function rollDropQuality() {
  const chance = Math.random() * 100;

  if (chance < DROP_RATES.rare) {
    return "Rare";
  }

  if (chance < DROP_RATES.rare + DROP_RATES.common) {
    return "Common";
  }

  return null;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function scaleStatsByQuality(stats, quality) {
  const multiplier =
    quality === "Rare"
      ? randomBetween(1.25, 1.6)
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

function generateMonsterDrop(monsterLevel) {
  const level = Number(monsterLevel || 1);

  if (level < 5) return null;

  const quality = rollDropQuality();

  if (!quality) return null;

  const possibleItems = shopItems.filter(
    (item) =>
      item.type !== "Consumable" &&
      Number(item.requiredLevel || 1) === level
  );

  if (possibleItems.length === 0) return null;

  const baseItem =
    possibleItems[Math.floor(Math.random() * possibleItems.length)];

  const stats = scaleStatsByQuality(baseItem.stats || {}, quality);
  const qualityEmoji = getQualityEmoji(quality);

  return {
    ...baseItem,

    id: `${baseItem.id}_${quality.toLowerCase()}_${Date.now()}_${Math.floor(
      Math.random() * 99999
    )}`,

    baseItemId: baseItem.id,
    name: baseItem.name.replace(/^Common /, `${quality} `),

    quality,
    qualityEmoji,

    requiredLevel: baseItem.requiredLevel,
    compatibleClasses: baseItem.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || 0) * (quality === "Rare" ? 1.75 : 1)
    ),

    description: makeDescription(stats),
    stats,
    quantity: 1,
    source: "monster_drop",
  };
}

module.exports = {
  DROP_RATES,
  generateMonsterDrop,
};