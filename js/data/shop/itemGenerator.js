const { getQualityEmoji } = require("../../utils/qualitySystem");
const balanceConfig = require("../balanceConfig");

const SHOP_QUALITY = "Common";

const tiers = balanceConfig.item?.levels || balanceConfig.ITEM_LEVELS || [];

/**
 * Final class item balance.
 *
 * This balances gear without needing to edit every generated item one by one.
 *
 * Swordsman  = balanced bruiser, slightly better all-around gear.
 * Archer     = strong attack, controlled dodge/crit.
 * Assassin   = highest burst identity, but reduced free dodge/crit from items.
 * Tanker     = still tanky, but HP/DEF gear scaling is reduced to avoid being unkillable.
 */
const DEFAULT_CLASS_ITEM_BALANCE = {
  swordsman: {
    attack: 1.08,
    defense: 1.08,
    maxHp: 1.05,
    dodge: 0.95,
    crit: 1.0,
  },

  archer: {
    attack: 1.05,
    defense: 0.95,
    maxHp: 0.95,
    dodge: 0.8,
    crit: 0.9,
  },

  assassin: {
    attack: 1.03,
    defense: 0.85,
    maxHp: 0.8,
    dodge: 0.7,
    crit: 0.82,
  },

  tanker: {
    attack: 0.85,
    defense: 0.78,
    maxHp: 0.75,
    dodge: 0.75,
    crit: 0.75,
  },
};

function toTitle(text) {
  return String(text || "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function getClassItemBalance(classId = "swordsman", customBalance = null) {
  const normalizedClassId = String(classId || "swordsman").toLowerCase();

  return (
    customBalance ||
    balanceConfig.classItemBalance?.[normalizedClassId] ||
    DEFAULT_CLASS_ITEM_BALANCE[normalizedClassId] ||
    DEFAULT_CLASS_ITEM_BALANCE.swordsman
  );
}

function applyClassItemBalance(baseStats = {}, classId = "swordsman", customBalance = null) {
  const balance = getClassItemBalance(classId, customBalance);

  return {
    attack: Number(baseStats.attack || 0) * Number(balance.attack || 1),
    defense: Number(baseStats.defense || 0) * Number(balance.defense || 1),
    maxHp: Number(baseStats.maxHp || 0) * Number(balance.maxHp || 1),
    dodge: Number(baseStats.dodge || 0) * Number(balance.dodge || 1),
    crit: Number(baseStats.crit || 0) * Number(balance.crit || 1),
  };
}

// Flat stats scale by tier.
// Used for ATK, DEF, and HP only.
function getFlatScale(tierIndex) {
  if (typeof balanceConfig.getItemScaleByTierIndex === "function") {
    return balanceConfig.getItemScaleByTierIndex(tierIndex);
  }

  return Number(
    (
      1 +
      Number(tierIndex || 0) *
        Number(balanceConfig.item?.scalePerTier || 0.38)
    ).toFixed(2)
  );
}

// Percentage stats scale slowly by tier.
// Used for Dodge and Crit only.
function getPercentScale(tierIndex) {
  if (typeof balanceConfig.getItemPercentScaleByTierIndex === "function") {
    return balanceConfig.getItemPercentScaleByTierIndex(tierIndex);
  }

  return Number(
    (
      1 +
      Number(tierIndex || 0) *
        Number(balanceConfig.item?.percentScalePerTier || 0.03)
    ).toFixed(2)
  );
}

// Per-item cap for Dodge/Crit.
// This prevents shop items from creating extreme dodge/crit values.
function capPercentStat(statName, value) {
  if (typeof balanceConfig.capItemPercentStat === "function") {
    return balanceConfig.capItemPercentStat(
      statName,
      value,
      SHOP_QUALITY,
      "shop"
    );
  }

  const cap = Number(balanceConfig.item?.statCaps?.[statName] || 0);
  const statValue = Number(value || 0);

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function makeStats(baseStats = {}, tierIndex = 0, classId = "swordsman", customBalance = null) {
  const balancedBaseStats = applyClassItemBalance(
    baseStats,
    classId,
    customBalance
  );

  const flatScale = getFlatScale(tierIndex);
  const percentScale = getPercentScale(tierIndex);

  const attack = Math.floor(
    Number(balancedBaseStats.attack || 0) * flatScale
  );

  const defense = Math.floor(
    Number(balancedBaseStats.defense || 0) * flatScale
  );

  const maxHp = Math.floor(
    Number(balancedBaseStats.maxHp || 0) * flatScale
  );

  const dodge = capPercentStat(
    "dodge",
    Number((Number(balancedBaseStats.dodge || 0) * percentScale).toFixed(1))
  );

  const crit = capPercentStat(
    "crit",
    Number((Number(balancedBaseStats.crit || 0) * percentScale).toFixed(1))
  );

  return {
    attack: Math.max(0, attack),
    defense: Math.max(0, defense),
    maxHp: Math.max(0, maxHp),
    dodge: Math.max(0, dodge),
    crit: Math.max(0, crit),
  };
}

function getShopItemPrice(type, level, tierIndex) {
  if (typeof balanceConfig.getShopItemPrice === "function") {
    return balanceConfig.getShopItemPrice(type, level, tierIndex);
  }

  const isWeapon = String(type || "").toLowerCase() === "weapon";
  const priceConfig = balanceConfig.item?.price || {};

  const base = isWeapon
    ? Number(priceConfig.weaponBase || 120)
    : Number(priceConfig.gearBase || 150);

  return Math.floor(
    base +
      Number(level || 1) * Number(priceConfig.levelMultiplier || 35) +
      (Number(tierIndex || 0) + 1) * Number(priceConfig.tierMultiplier || 80)
  );
}

function normalizeType(type = "Unknown") {
  const normalizedType = String(type || "Unknown").toLowerCase();

  const typeMap = {
    weapon: "Weapon",
    helmet: "Helmet",
    armor: "Armor",
    gloves: "Gloves",
    pants: "Pants",
    boots: "Boots",
  };

  return typeMap[normalizedType] || type;
}

function buildShopItem({
  id,
  name,
  type,
  quality,
  requiredLevel,
  compatibleClasses,
  price,
  description,
  stats,
  emoji,
}) {
  const normalizedQuality = quality || SHOP_QUALITY;

  return {
    id,
    baseItemId: id,

    name,
    type: normalizeType(type),

    quality: normalizedQuality,
    qualityEmoji: getQualityEmoji(normalizedQuality),

    requiredLevel: Number(requiredLevel || 1),
    compatibleClasses: compatibleClasses || ["all"],

    price: Math.max(0, Math.floor(Number(price || 0))),
    description: description || "No bonus stats",

    stats: stats || {
      attack: 0,
      defense: 0,
      maxHp: 0,
      dodge: 0,
      crit: 0,
    },

    quantity: 1,
    emoji: emoji || "📦",
    source: "shop",
  };
}

function generateClassItems(config = {}) {
  const items = [];

  if (!config.classId || !config.weapon || !Array.isArray(config.gears)) {
    return items;
  }

  const classId = String(config.classId || "swordsman").toLowerCase();
  const customBalance = config.itemBalance || null;

  tiers.forEach(([level, tier], index) => {
    const tierName = toTitle(tier);

    const weaponStats = makeStats(
      config.weapon.stats || {},
      index,
      classId,
      customBalance
    );

    items.push(
      buildShopItem({
        id: `${classId}_${tier}_weapon`,
        name: `${SHOP_QUALITY} ${tierName} ${config.weapon.name}`,
        type: "Weapon",
        quality: SHOP_QUALITY,
        requiredLevel: level,
        compatibleClasses: [classId],
        price: getShopItemPrice("Weapon", level, index),
        description: makeDescription(weaponStats),
        stats: weaponStats,
        emoji: config.weapon.emoji,
      })
    );

    config.gears.forEach((gear) => {
      const gearStats = makeStats(
        gear.stats || {},
        index,
        classId,
        customBalance
      );

      items.push(
        buildShopItem({
          id: `${classId}_${tier}_${gear.slot}`,
          name: `${SHOP_QUALITY} ${tierName} ${gear.name}`,
          type: gear.type,
          quality: SHOP_QUALITY,
          requiredLevel: level,
          compatibleClasses: [classId],
          price: getShopItemPrice(gear.type, level, index),
          description: makeDescription(gearStats),
          stats: gearStats,
          emoji: gear.emoji,
        })
      );
    });
  });

  return items;
}

module.exports = generateClassItems;