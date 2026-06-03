const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("./qualitySystem");
const balanceConfig = require("../data/balanceConfig");

const VALID_DROP_QUALITIES = ["Common", "Rare"];

const DROP_RATES = balanceConfig.monsterDrop?.rates || {
  rare: 8,
  common: 32,
  none: 60,
};

function normalizeQuality(quality = "Common") {
  const normalized = String(quality || "Common");

  return VALID_DROP_QUALITIES.includes(normalized) ? normalized : "Common";
}

function rollDropQuality() {
  const chance = Math.random() * 100;

  const rareRate = Math.max(0, Number(DROP_RATES.rare || 0));
  const commonRate = Math.max(0, Number(DROP_RATES.common || 0));

  if (chance < rareRate) {
    return "Rare";
  }

  if (chance < rareRate + commonRate) {
    return "Common";
  }

  return null;
}

function getNearestItemLevel(monsterLevel) {
  if (typeof balanceConfig.getNearestItemLevel === "function") {
    return balanceConfig.getNearestItemLevel(monsterLevel);
  }

  const level = Number(monsterLevel || 1);

  const itemLevels =
    balanceConfig.item?.levels ||
    balanceConfig.ITEM_LEVELS ||
    [];

  if (!itemLevels.length) return level;

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

function getRollMultiplier(quality = "Common") {
  const normalizedQuality = normalizeQuality(quality);

  const rollConfig =
    balanceConfig.monsterDrop?.statRolls?.[normalizedQuality] ||
    balanceConfig.monsterDrop?.statRolls?.Common ||
    {
      min: 1,
      max: 1.05,
    };

  const min = Number(rollConfig.min || 1);
  const max = Number(rollConfig.max || min);

  if (typeof balanceConfig.randomBetween === "function") {
    return balanceConfig.randomBetween(min, max);
  }

  if (max <= min) return min;

  return Math.random() * (max - min) + min;
}

function capPercentStat(statName, value, quality = "Common") {
  const normalizedQuality = normalizeQuality(quality);
  const statValue = Number(value || 0);

  if (typeof balanceConfig.capItemPercentStat === "function") {
    return balanceConfig.capItemPercentStat(
      statName,
      statValue,
      normalizedQuality,
      "monster_drop"
    );
  }

  const monsterCap = Number(
    balanceConfig.monsterDrop?.statCaps?.[normalizedQuality]?.[statName] || 0
  );

  const shopCap = Number(
    balanceConfig.item?.statCaps?.[statName] || 0
  );

  const cap = monsterCap || shopCap;

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function scaleStatsByQuality(stats = {}, quality = "Common") {
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

function getPriceMultiplier(quality = "Common") {
  const normalizedQuality = normalizeQuality(quality);

  return Number(
    balanceConfig.monsterDrop?.priceMultiplier?.[normalizedQuality] || 1
  );
}

function cleanItemName(name, quality) {
  const normalizedQuality = normalizeQuality(quality);

  const baseName = String(name || "Unknown Item").replace(
    /^(Common|Rare|Legendary|Starter)\s+/i,
    ""
  );

  return `${normalizedQuality} ${baseName}`;
}

function getPossibleDropItems(itemLevel) {
  return shopItems.filter((item) => {
    const type = String(item.type || "").toLowerCase();

    if (type === "consumable") return false;

    return Number(item.requiredLevel || 1) === Number(itemLevel || 1);
  });
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

  const normalizedQuality = normalizeQuality(quality);
  const itemLevel = getNearestItemLevel(level);
  const possibleItems = getPossibleDropItems(itemLevel);

  if (possibleItems.length === 0) {
    return null;
  }

  const baseItem =
    possibleItems[Math.floor(Math.random() * possibleItems.length)];

  const stats = scaleStatsByQuality(baseItem.stats || {}, normalizedQuality);
  const qualityEmoji = getQualityEmoji(normalizedQuality);

  return {
    ...baseItem,

    id: `${baseItem.id}_${normalizedQuality.toLowerCase()}_monster_${Date.now()}_${Math.floor(
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
    source: "monster_drop",
    emoji: baseItem.emoji || "📦",
  };
}

function addItemToInventory(inventory = [], droppedItem) {
  if (!droppedItem) return inventory;

  const existingItemIndex = inventory.findIndex((item) => {
    if (!item) return false;

    return (
      item.baseItemId === droppedItem.baseItemId &&
      item.quality === droppedItem.quality &&
      item.source === droppedItem.source &&
      JSON.stringify(item.stats || {}) ===
        JSON.stringify(droppedItem.stats || {})
    );
  });

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
  VALID_DROP_QUALITIES,
  DROP_RATES,

  normalizeQuality,
  rollDropQuality,
  getNearestItemLevel,
  getRollMultiplier,
  capPercentStat,
  scaleStatsByQuality,

  generateMonsterDrop,
  addItemToInventory,
};