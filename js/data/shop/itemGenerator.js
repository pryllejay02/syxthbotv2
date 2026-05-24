const { QUALITIES, getQualityEmoji } = require("../../utils/qualitySystem");

const tiers = [
  [5, "iron"],
  [10, "steel"],
  [15, "knight"],
  [20, "silver"],
  [25, "royal"],
  [30, "guardian"],
  [35, "battle"],
  [40, "valor"],
  [45, "rune"],
  [50, "titan"],
  [55, "warborn"],
  [60, "ancient"],
  [65, "storm"],
  [70, "inferno"],
  [75, "abyss"],
  [80, "celestial"],
  [85, "dragon"],
  [90, "elder_dragon"],
];

function toTitle(text) {
  return text
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function makeStats(baseStats, scale, qualityMultiplier = 1) {
  return {
    attack: Math.floor((baseStats.attack || 0) * scale * qualityMultiplier),
    defense: Math.floor((baseStats.defense || 0) * scale * qualityMultiplier),
    maxHp: Math.floor((baseStats.maxHp || 0) * scale * qualityMultiplier),
    dodge: Number(((baseStats.dodge || 0) * scale * qualityMultiplier).toFixed(1)),
    crit: Number(((baseStats.crit || 0) * scale * qualityMultiplier).toFixed(1)),
  };
}

function generateClassItems(config) {
  const items = [];

  tiers.forEach(([level, tier], index) => {
    const scale = index + 1;
    const tierName = toTitle(tier);

    Object.entries(QUALITIES).forEach(([quality, qualityData]) => {
      const qualityId = quality.toLowerCase();

      const weaponStats = makeStats(
        config.weapon.stats,
        scale,
        qualityData.statMultiplier
      );

      items.push({
        id: `${config.classId}_${tier}_weapon_${qualityId}`,
        name: `${quality} ${tierName} ${config.weapon.name}`,
        type: "Weapon",
        quality,
        qualityEmoji: getQualityEmoji(quality),
        requiredLevel: level,
        compatibleClasses: [config.classId],
        price: Math.floor((100 + scale * 150) * qualityData.priceMultiplier),
        description: makeDescription(weaponStats),
        stats: weaponStats,
        emoji: config.weapon.emoji,
      });

      config.gears.forEach((gear) => {
        const gearStats = makeStats(
          gear.stats,
          scale,
          qualityData.statMultiplier
        );

        items.push({
          id: `${config.classId}_${tier}_${gear.slot}_${qualityId}`,
          name: `${quality} ${tierName} ${gear.name}`,
          type: gear.type,
          quality,
          qualityEmoji: getQualityEmoji(quality),
          requiredLevel: level,
          compatibleClasses: [config.classId],
          price: Math.floor((150 + scale * 150) * qualityData.priceMultiplier),
          description: makeDescription(gearStats),
          stats: gearStats,
          emoji: gear.emoji,
        });
      });
    });
  });

  return items;
}

module.exports = generateClassItems;