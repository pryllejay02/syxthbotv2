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

function makeStats(baseStats = {}, scale = 1) {
  return {
    attack: Math.floor(Number(baseStats.attack || 0) * scale),
    defense: Math.floor(Number(baseStats.defense || 0) * scale),
    maxHp: Math.floor(Number(baseStats.maxHp || 0) * scale),
    dodge: Number((Number(baseStats.dodge || 0) * scale).toFixed(1)),
    crit: Number((Number(baseStats.crit || 0) * scale).toFixed(1)),
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
    name,
    type,
    quality,
    qualityEmoji: getQualityEmoji(quality),
    requiredLevel,
    compatibleClasses,
    price,
    description,
    stats,
    emoji,
  };
}

function generateClassItems(config = {}) {
  const items = [];

  if (!config.classId || !config.weapon || !Array.isArray(config.gears)) {
    return items;
  }

  tiers.forEach(([level, tier], index) => {
    const scale = balanceConfig.getItemScaleByTierIndex(index);
    const tierName = toTitle(tier);

    const weaponStats = makeStats(config.weapon.stats || {}, scale);

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
      const gearStats = makeStats(gear.stats || {}, scale);

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