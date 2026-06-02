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
    balanceConfig.item?.levels ||
    balanceConfig.ITEM_LEVELS ||
    [];

  if (!itemLevels.length) {
    return level;
  }

  let nearest = Array.isArray(itemLevels[0])
    ? Number(itemLevels[0][0] || 1)
    : Number(itemLevels[0] || 1);

  for (const entry of itemLevels) {
    const itemLevel = Array.isArray(entry) ? entry[0] : entry;

    if (Number(itemLevel) <= level) {
      nearest = Number(itemLevel);
    }
  }

  return nearest;
}

function normalizeQuality(quality = "Rare") {
  return ["Rare", "Legendary"].includes(quality) ? quality : "Rare";
}

function getRollMultiplier(quality = "Rare") {
  const normalizedQuality = normalizeQuality(quality);

  const rollConfig =
    balanceConfig.bossDrop?.statRolls?.[normalizedQuality] ||
    balanceConfig.bossDrop?.statRolls?.Rare ||
    {
      min: 1.25,
      max: 1.45,
    };

  const min = Number(rollConfig.min || 1);
  const max = Number(rollConfig.max || min);

  if (typeof balanceConfig.randomBetween === "function") {
    return balanceConfig.randomBetween(min, max);
  }

  if (max <= min) return min;

  return Math.random() * (max - min) + min;
}

function capPercentStat(statName, value, quality = "Rare") {
  const normalizedQuality = normalizeQuality(quality);
  const statValue = Number(value || 0);

  if (typeof balanceConfig.capItemPercentStat === "function") {
    return balanceConfig.capItemPercentStat(
      statName,
      statValue,
      normalizedQuality,
      "boss_raid"
    );
  }

  const bossCap = Number(
    balanceConfig.bossDrop?.statCaps?.[normalizedQuality]?.[statName] || 0
  );

  const shopCap = Number(
    balanceConfig.item?.statCaps?.[statName] || 0
  );

  const cap = bossCap || shopCap;

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function scaleStatsByQuality(stats = {}, quality = "Rare") {
  const normalizedQuality = normalizeQuality(quality);
  const multiplier = getRollMultiplier(normalizedQuality);

  const attack = Math.floor(Number(stats.attack || 0) * multiplier);
  const defense = Math.floor(Number(stats.defense || 0) * multiplier);
  const maxHp = Math.floor(Number(stats.maxHp || 0) * multiplier);

  const dodge = capPercentStat(
    "dodge",
    Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
    normalizedQuality
  );

  const crit = capPercentStat(
    "crit",
    Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
    normalizedQuality
  );

  return {
    attack,
    defense,
    maxHp,
    dodge,
    crit,
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
  const normalizedQuality = normalizeQuality(quality);

  return Number(
    balanceConfig.bossDrop?.priceMultiplier?.[normalizedQuality] || 1
  );
}

function cleanItemName(name, quality) {
  const baseName = String(name || "Unknown Item").replace(
    /^(Common|Rare|Legendary|Starter)\s+/i,
    ""
  );

  return `${quality} ${baseName}`;
}

function getPossibleBossDropItems(itemLevel) {
  return shopItems.filter((item) => {
    const type = String(item.type || "").toLowerCase();

    if (type === "consumable") return false;

    return Number(item.requiredLevel || 1) === Number(itemLevel || 1);
  });
}

function generateBossDrop(bossLevel, quality = "Rare") {
  const normalizedQuality = normalizeQuality(quality);
  const itemLevel = getNearestItemLevel(bossLevel);
  const possibleItems = getPossibleBossDropItems(itemLevel);

  if (possibleItems.length === 0) {
    return null;
  }

  const baseItem =
    possibleItems[Math.floor(Math.random() * possibleItems.length)];

  const stats = scaleStatsByQuality(
    baseItem.stats || {},
    normalizedQuality
  );

  const qualityEmoji = getQualityEmoji(normalizedQuality);

  return {
    ...baseItem,

    id: `${baseItem.id}_${normalizedQuality.toLowerCase()}_boss_${Date.now()}_${Math.floor(
      Math.random() * 99999
    )}`,

    baseItemId: baseItem.baseItemId || baseItem.id,
    name: cleanItemName(baseItem.name, normalizedQuality),

    quality: normalizedQuality,
    qualityEmoji,

    requiredLevel: itemLevel,
    compatibleClasses: baseItem.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || 0) * getPriceMultiplier(normalizedQuality)
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
      item.source === droppedItem.source &&
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
  getNearestItemLevel,
  scaleStatsByQuality,
  generateBossDrop,
  addItemToInventory,
};