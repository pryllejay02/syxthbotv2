const { getQualityEmoji } = require("../../utils/qualitySystem");
const balanceConfig = require("../balanceConfig");

const SHOP_QUALITY = "Common";

const tiers = balanceConfig.item?.levels || balanceConfig.ITEM_LEVELS || [];

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

// Flat stats scale strongly by tier.
// Used for ATK, DEF, and HP.
function getFlatScale(tierIndex) {
  if (typeof balanceConfig.getItemScaleByTierIndex === "function") {
    return balanceConfig.getItemScaleByTierIndex(tierIndex);
  }

  return Number(
    (
      1 +
      Number(tierIndex || 0) *
        Number(balanceConfig.item?.scalePerTier || 0.85)
    ).toFixed(2)
  );
}

// Percentage stats scale slowly by tier.
// Used for Dodge and Crit only.
function getPercentScale(tierIndex) {
  return Number(
    (
      1 +
      Number(tierIndex || 0) *
        Number(balanceConfig.item?.percentScalePerTier || 0.08)
    ).toFixed(2)
  );
}

// Per-item cap for Common shop item Dodge/Crit.
// This prevents shop items from creating extreme dodge/crit values.
function capPercentStat(statName, value) {
  const cap = Number(balanceConfig.item?.statCaps?.[statName] || 0);

  if (!cap) return value;

  return Math.min(value, cap);
}

function makeStats(baseStats = {}, tierIndex = 0) {
  const flatScale = getFlatScale(tierIndex);
  const percentScale = getPercentScale(tierIndex);

  const attack = Math.floor(Number(baseStats.attack || 0) * flatScale);
  const defense = Math.floor(Number(baseStats.defense || 0) * flatScale);
  const maxHp = Math.floor(Number(baseStats.maxHp || 0) * flatScale);

  const dodge = capPercentStat(
    "dodge",
    Number((Number(baseStats.dodge || 0) * percentScale).toFixed(1))
  );

  const crit = capPercentStat(
    "crit",
    Number((Number(baseStats.crit || 0) * percentScale).toFixed(1))
  );

  return {
    attack,
    defense,
    maxHp,
    dodge,
    crit,
  };
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
  return {
    id,
    baseItemId: id,

    name,
    type,

    quality,
    qualityEmoji: getQualityEmoji(quality),

    requiredLevel: Number(requiredLevel || 1),
    compatibleClasses: compatibleClasses || ["all"],

    price: Number(price || 0),
    description: description || "No bonus stats",

    stats: stats || {
      attack: 0,
      defense: 0,
      maxHp: 0,
      dodge: 0,
      crit: 0,
    },

    emoji: emoji || "📦",
    source: "shop",
  };
}

function generateClassItems(config = {}) {
  const items = [];

  if (!config.classId || !config.weapon || !Array.isArray(config.gears)) {
    return items;
  }

  tiers.forEach(([level, tier], index) => {
    const tierName = toTitle(tier);

    const weaponStats = makeStats(config.weapon.stats || {}, index);

    items.push(
      buildShopItem({
        id: `${config.classId}_${tier}_weapon`,
        name: `${SHOP_QUALITY} ${tierName} ${config.weapon.name}`,
        type: "Weapon",
        quality: SHOP_QUALITY,
        requiredLevel: level,
        compatibleClasses: [config.classId],
        price: balanceConfig.getShopItemPrice("Weapon", level, index),
        description: makeDescription(weaponStats),
        stats: weaponStats,
        emoji: config.weapon.emoji,
      })
    );

    config.gears.forEach((gear) => {
      const gearStats = makeStats(gear.stats || {}, index);

      items.push(
        buildShopItem({
          id: `${config.classId}_${tier}_${gear.slot}`,
          name: `${SHOP_QUALITY} ${tierName} ${gear.name}`,
          type: gear.type,
          quality: SHOP_QUALITY,
          requiredLevel: level,
          compatibleClasses: [config.classId],
          price: balanceConfig.getShopItemPrice(gear.type, level, index),
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