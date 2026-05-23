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

function makeStats(baseStats, scale) {
  return {
    attack: Math.floor((baseStats.attack || 0) * scale),
    defense: Math.floor((baseStats.defense || 0) * scale),
    maxHp: Math.floor((baseStats.maxHp || 0) * scale),
    dodge: Number(((baseStats.dodge || 0) * scale).toFixed(1)),
    crit: Number(((baseStats.crit || 0) * scale).toFixed(1)),
  };
}

function generateClassItems(config) {
  const items = [];

  tiers.forEach(([level, tier], index) => {
    const scale = index + 1;
    const tierName = toTitle(tier);

    const weaponStats = makeStats(config.weapon.stats, scale);

    items.push({
      id: `${config.classId}_${tier}_weapon`,
      name: `Common ${tierName} ${config.weapon.name}`,
      type: "Weapon",
      quality: "Common",
      requiredLevel: level,
      compatibleClasses: [config.classId],
      price: 100 + scale * 150,
      description: makeDescription(weaponStats),
      stats: weaponStats,
      emoji: config.weapon.emoji,
    });

    config.gears.forEach((gear) => {
      const gearStats = makeStats(gear.stats, scale);

      items.push({
        id: `${config.classId}_${tier}_${gear.slot}`,
        name: `Common ${tierName} ${gear.name}`,
        type: gear.type,
        quality: "Common",
        requiredLevel: level,
        compatibleClasses: [config.classId],
        price: 150 + scale * 150,
        description: makeDescription(gearStats),
        stats: gearStats,
        emoji: gear.emoji,
      });
    });
  });

  return items;
}

module.exports = generateClassItems;