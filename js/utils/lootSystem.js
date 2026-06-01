const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("./qualitySystem");
const balanceConfig = require("../data/balanceConfig");

const DROP_RATES = balanceConfig.monsterDrop?.rates || {
  rare: 10,
  common: 35,
  none: 55,
};

function rollDropQuality() {
  const chance = Math.random() * 100;

  const rareRate = Number(DROP_RATES.rare || 0);
  const commonRate = Number(DROP_RATES.common || 0);

  if (chance < rareRate) {
    return "Rare";
  }

  if (chance < rareRate + commonRate) {
    return "Common";
  }

  return null;
}

function getNearestItemLevel(monsterLevel) {
  const level = Number(monsterLevel || 1);
  const itemLevels = balanceConfig.item?.levels || balanceConfig.ITEM_LEVELS || [];

  if (!itemLevels.length) return level;

  let nearest = Number(itemLevels[0][0] || 1);

  for (const [itemLevel] of itemLevels) {
    if (Number(itemLevel) <= level) {
      nearest = Number(itemLevel);
    }
  }

  return nearest;
}

function scaleStatsByQuality(stats = {}, quality = "Common") {
  const rollConfig =
    balanceConfig.monsterDrop?.statRolls?.[quality] ||
    balanceConfig.monsterDrop?.statRolls?.Common ||
    {
      min: 1,
      max: 1.1,
    };

  const multiplier =
    typeof balanceConfig.randomBetween === "function"
      ? balanceConfig.randomBetween(rollConfig.min, rollConfig.max)
      : Math.random() * (Number(rollConfig.max || 1) - Number(rollConfig.min || 1)) +
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

function getPriceMultiplier(quality = "Common") {
  return Number(
    balanceConfig.monsterDrop?.priceMultiplier?.[quality] || 1
  );
}

function cleanItemName(name, quality) {
  const baseName = String(name || "Unknown Item").replace(/^Common /, "");

  return `${quality} ${baseName}`;
}

function generateMonsterDrop(monsterLevel) {
  const level = Number(monsterLevel || 1);
  const minDropLevel = Number(balanceConfig.monsterDrop?.minLevel || 5);

  if (level < minDropLevel) {
    return null;
  }

  const quality = rollDropQuality();

  if (!quality) {
    return null;
  }

  const itemLevel = getNearestItemLevel(level);

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

    id: `${baseItem.id}_${quality.toLowerCase()}_${Date.now()}_${Math.floor(
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
    source: "monster_drop",
    emoji: baseItem.emoji || "📦",
  };
}

module.exports = {
  DROP_RATES,
  rollDropQuality,
  generateMonsterDrop,
};