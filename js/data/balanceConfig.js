const MAX_LEVEL = 99;

const ITEM_LEVELS = [
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

const balanceConfig = {
  maxLevel: MAX_LEVEL,

  // Final player stat caps after base stats + equipment.
  statCaps: {
    dodge: 75,
    crit: 85,
  },

  economy: {
    startingGold: 500,
    restCost: 100,

    retreat: {
      goldPenaltyPercent: 5,
      minPenalty: 5,
      maxPenalty: 100,
    },

    sellMultiplier: {
      Starter: 0,
      Common: 0.5,
      Rare: 0.75,
      Legendary: 0.85,
      default: 0.5,
    },
  },

  revive: {
    normalSeconds: 60,
    raidSeconds: 15,
    freeReviveHpPercent: 50,
    raidReviveHpPercent: 50,
  },

  combat: {
    normalHitRandomBonus: {
      min: 1,
      max: 8,
    },

    raidPlayerHitRandomBonus: {
      min: 5,
      max: 19,
    },

    raidBossHitRandomBonus: {
      min: 10,
      max: 29,
    },
  },

  commandCooldowns: {
    hunt: 3000,
    hit: 1800,
    rest: 3000,
    buy: 1500,
    sell: 1500,
    use: 1500,
    equip: 1500,
    unequip: 1500,
    inventory: 2500,
    inv: 2500,
    profile: 2500,
    character: 2500,
    char: 2500,
    leaderboard: 5000,
    lb: 5000,
    flex: 3000,
    trade: 1500,
    party: 1500,
    raid: 2500,
  },

  powerFormula: {
    attack: 1,
    defense: 1.5,
    maxHp: 0.2,
    dodge: 10,
    crit: 10,
    level: 100,
    kills: 3,
  },

  shop: {
    maxBuyQuantity: 99,
  },

  adminItem: {
    maxQuantity: 50,

    statRolls: {
      Common: {
        min: 1.0,
        max: 1.12,
      },

      Rare: {
        min: 1.25,
        max: 1.55,
      },

      Legendary: {
        min: 1.85,
        max: 2.35,
      },
    },
  },

  classBaseStats: {
    swordsman: {
      maxHp: 125,
      attack: 14,
      defense: 8,
      dodge: 5,
      crit: 8,
    },

    archer: {
      maxHp: 100,
      attack: 18,
      defense: 5,
      dodge: 11,
      crit: 14,
    },

    assassin: {
      maxHp: 90,
      attack: 20,
      defense: 4,
      dodge: 15,
      crit: 18,
    },

    tanker: {
      maxHp: 175,
      attack: 10,
      defense: 15,
      dodge: 3,
      crit: 5,
    },
  },

  classGrowth: {
    swordsman: {
      maxHp: 13,
      attack: 3,
      defense: 2,
      dodge: 0.06,
      crit: 0.05,
    },

    archer: {
      maxHp: 10,
      attack: 3.4,
      defense: 1.3,
      dodge: 0.09,
      crit: 0.11,
    },

    assassin: {
      maxHp: 9,
      attack: 3.6,
      defense: 1.1,
      dodge: 0.12,
      crit: 0.14,
    },

    tanker: {
      maxHp: 18,
      attack: 2.2,
      defense: 3.1,
      dodge: 0.03,
      crit: 0.03,
    },
  },

  quality: {
    Starter: {
      emoji: "🌱",
      color: "#84CC16",
      statMultiplier: 0,
      priceMultiplier: 0,
    },

    Common: {
      emoji: "🟢",
      color: "#22C55E",
      statMultiplier: 1,
      priceMultiplier: 1,
    },

    Rare: {
      emoji: "🔵",
      color: "#3B82F6",
      statMultiplier: 1.4,
      priceMultiplier: 2,
    },

    Legendary: {
      emoji: "🟠",
      color: "#F59E0B",
      statMultiplier: 2.15,
      priceMultiplier: 5,
    },
  },

  item: {
    levels: ITEM_LEVELS,

    // Used for ATK, DEF, and HP only.
    scalePerTier: 0.85,

    // Used for Dodge and Crit only.
    // This prevents high-level items from getting extreme % stats.
    percentScalePerTier: 0.08,

    // Per Common shop item cap before Rare/Legendary roll multipliers.
    // Example: one Common shop item can only have up to 4 Dodge / 5 Crit.
    statCaps: {
      dodge: 4,
      crit: 5,
    },

    price: {
      weaponBase: 120,
      gearBase: 150,
      levelMultiplier: 35,
      tierMultiplier: 80,
    },
  },

  monsterRewards: {
    expMultiplier: 1,
    goldMultiplier: 1,

    // Normal monsters rely on these formulas by default.
    // If a monster has rewardOverride: true, then monster.exp / monster.gold will be used.
    expFormula(level) {
      const lv = Number(level || 1);
      return Math.floor(35 + lv * 12 + lv * lv * 0.65);
    },

    goldFormula(level) {
      const lv = Number(level || 1);
      return Math.floor(25 + lv * 7 + lv * lv * 0.28);
    },
  },

  monsterDrop: {
    minLevel: 5,

    rates: {
      rare: 10,
      common: 35,
      none: 55,
    },

    statRolls: {
      Common: {
        min: 1.0,
        max: 1.12,
      },

      Rare: {
        min: 1.25,
        max: 1.55,
      },
    },

    priceMultiplier: {
      Common: 1,
      Rare: 1.75,
    },
  },

  bossDrop: {
    itemLevels: ITEM_LEVELS.map(([level]) => level),

    statRolls: {
      Rare: {
        min: 1.35,
        max: 1.65,
      },

      Legendary: {
        min: 1.85,
        max: 2.35,
      },
    },

    priceMultiplier: {
      Rare: 2,
      Legendary: 5,
    },
  },

  boss: {
    rankingDeleteMinutes: 10,
    bossExpireMinutes: 120,

    participationRareChance: 25,

    legendaryChance: {
      top1: 12,
      top2to5: 7,
      top6to10: 3,
    },

    partyBonus: {
      legendaryChance: 3,
      gold: 5,
      exp: 5,
    },

    rewardPenalty: [
      {
        maxLevelDifference: 10,
        goldMultiplier: 1,
        expMultiplier: 1,
        dropMultiplier: 1,
        legendaryAllowed: true,
        label: "Full Reward",
      },
      {
        maxLevelDifference: 20,
        goldMultiplier: 0.8,
        expMultiplier: 0.8,
        dropMultiplier: 0.8,
        legendaryAllowed: true,
        label: "Slightly Reduced",
      },
      {
        maxLevelDifference: 30,
        goldMultiplier: 0.5,
        expMultiplier: 0.5,
        dropMultiplier: 0.4,
        legendaryAllowed: true,
        label: "Reduced",
      },
      {
        maxLevelDifference: 50,
        goldMultiplier: 0.25,
        expMultiplier: 0,
        dropMultiplier: 0.15,
        legendaryAllowed: false,
        label: "Heavily Reduced",
      },
    ],

    rewardPenaltyFallback: {
      goldMultiplier: 0.1,
      expMultiplier: 0,
      dropMultiplier: 0.05,
      legendaryAllowed: false,
      label: "Almost No Reward",
    },
  },
};

function getRequiredExp(level) {
  const lv = Math.max(1, Number(level || 1));

  if (lv >= MAX_LEVEL) return Infinity;

  if (lv <= 10) {
    return Math.floor(40 + lv * 30 + lv * lv * 6);
  }

  if (lv <= 30) {
    return Math.floor(250 + lv * 60 + lv * lv * 14);
  }

  if (lv <= 60) {
    return Math.floor(800 + lv * 110 + lv * lv * 24);
  }

  if (lv <= 90) {
    return Math.floor(1800 + lv * 170 + lv * lv * 38);
  }

  return Math.floor(5000 + lv * 250 + lv * lv * 50);
}

function getClassBaseStats(classId = "swordsman") {
  return (
    balanceConfig.classBaseStats[classId] ||
    balanceConfig.classBaseStats.swordsman
  );
}

function getClassGrowth(classId = "swordsman") {
  return (
    balanceConfig.classGrowth[classId] ||
    balanceConfig.classGrowth.swordsman
  );
}

function getLevelStatGain(classId = "swordsman", level = 1) {
  const growth = getClassGrowth(classId);
  const lv = Number(level || 1);

  let stageMultiplier = 1;

  if (lv > 80) {
    stageMultiplier = 1.25;
  } else if (lv > 50) {
    stageMultiplier = 1.15;
  } else if (lv > 20) {
    stageMultiplier = 1.05;
  }

  return {
    maxHp: Math.floor(Number(growth.maxHp || 0) * stageMultiplier),
    attack: Number((Number(growth.attack || 0) * stageMultiplier).toFixed(2)),
    defense: Number((Number(growth.defense || 0) * stageMultiplier).toFixed(2)),
    dodge: Number(Number(growth.dodge || 0).toFixed(2)),
    crit: Number(Number(growth.crit || 0).toFixed(2)),
  };
}

function getBaseStatsByClassLevel(classId = "swordsman", level = 1) {
  const targetLevel = Math.max(1, Number(level || 1));
  const base = getClassBaseStats(classId);

  let attack = Number(base.attack || 10);
  let defense = Number(base.defense || 5);
  let maxHp = Number(base.maxHp || 100);
  let dodge = Number(base.dodge || 0);
  let crit = Number(base.crit || 0);

  for (let currentLevel = 2; currentLevel <= targetLevel; currentLevel++) {
    const gain = getLevelStatGain(classId, currentLevel);

    attack += Number(gain.attack || 0);
    defense += Number(gain.defense || 0);
    maxHp += Number(gain.maxHp || 0);
    dodge += Number(gain.dodge || 0);
    crit += Number(gain.crit || 0);
  }

  return {
    attack: Math.floor(attack),
    defense: Math.floor(defense),
    maxHp: Math.floor(maxHp),
    dodge: Number(dodge.toFixed(2)),
    crit: Number(crit.toFixed(2)),
  };
}

function getItemScaleByTierIndex(index) {
  const safeIndex = Math.max(0, Number(index || 0));

  return Number(
    (1 + safeIndex * Number(balanceConfig.item.scalePerTier || 0.85)).toFixed(2)
  );
}

function getItemPercentScaleByTierIndex(index) {
  const safeIndex = Math.max(0, Number(index || 0));

  return Number(
    (
      1 +
      safeIndex * Number(balanceConfig.item.percentScalePerTier || 0.08)
    ).toFixed(2)
  );
}

function capItemPercentStat(statName, value) {
  const cap = Number(balanceConfig.item?.statCaps?.[statName] || 0);
  const statValue = Number(value || 0);

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function getShopItemPrice(type, level, tierIndex) {
  const isWeapon = String(type || "").toLowerCase() === "weapon";
  const priceConfig = balanceConfig.item.price;

  const base = isWeapon
    ? Number(priceConfig.weaponBase || 120)
    : Number(priceConfig.gearBase || 150);

  return Math.floor(
    base +
      Number(level || 1) * Number(priceConfig.levelMultiplier || 35) +
      (Number(tierIndex || 0) + 1) * Number(priceConfig.tierMultiplier || 80)
  );
}

function getNearestItemLevel(level) {
  const currentLevel = Number(level || 1);
  let nearest = balanceConfig.bossDrop.itemLevels[0] || 5;

  for (const itemLevel of balanceConfig.bossDrop.itemLevels) {
    if (itemLevel <= currentLevel) {
      nearest = itemLevel;
    }
  }

  return nearest;
}

function randomBetween(min, max) {
  const safeMin = Number(min || 0);
  const safeMax = Number(max || safeMin);

  if (safeMax <= safeMin) return safeMin;

  return Math.random() * (safeMax - safeMin) + safeMin;
}

function randomIntBetween(min, max) {
  const safeMin = Math.ceil(Number(min || 0));
  const safeMax = Math.floor(Number(max || safeMin));

  if (safeMax <= safeMin) return safeMin;

  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function getMonsterReward(monster = {}) {
  const level = Number(monster.level || 1);
  const useManualReward = monster.rewardOverride === true;

  const baseExp = useManualReward
    ? Number(monster.exp || 0)
    : balanceConfig.monsterRewards.expFormula(level);

  const baseGold = useManualReward
    ? Number(monster.gold || 0)
    : balanceConfig.monsterRewards.goldFormula(level);

  return {
    exp: Math.max(
      1,
      Math.floor(
        Number(baseExp || 1) *
          Number(balanceConfig.monsterRewards.expMultiplier || 1)
      )
    ),

    gold: Math.max(
      0,
      Math.floor(
        Number(baseGold || 0) *
          Number(balanceConfig.monsterRewards.goldMultiplier || 1)
      )
    ),
  };
}

function getBossRewardPenalty(playerLevel, bossLevel) {
  const levelDifference = Number(playerLevel || 1) - Number(bossLevel || 1);

  for (const penalty of balanceConfig.boss.rewardPenalty) {
    if (levelDifference <= Number(penalty.maxLevelDifference || 0)) {
      return penalty;
    }
  }

  return balanceConfig.boss.rewardPenaltyFallback;
}

function getSellMultiplier(quality = "Common") {
  return (
    balanceConfig.economy.sellMultiplier[quality] ??
    balanceConfig.economy.sellMultiplier.default
  );
}

function getCombatRandomBonus(type) {
  const combatConfig = balanceConfig.combat[type];

  if (!combatConfig) return 0;

  return randomIntBetween(combatConfig.min, combatConfig.max);
}

function calculatePower(player = {}) {
  const formula = balanceConfig.powerFormula;

  const attack = Number(player.attack || 0);
  const defense = Number(player.defense || 0);
  const maxHp = Number(player.maxHp || 0);
  const dodge = Number(player.dodge || 0);
  const crit = Number(player.crit || 0);
  const level = Number(player.level || 1);

  return Math.floor(
    attack * Number(formula.attack || 1) +
      defense * Number(formula.defense || 1.5) +
      maxHp * Number(formula.maxHp || 0.2) +
      dodge * Number(formula.dodge || 10) +
      crit * Number(formula.crit || 10) +
      level * Number(formula.level || 100)
  );
}

function calculateOverallScore(player = {}) {
  const power = calculatePower(player);
  const kills = Number(player.monsterKills || 0);

  return Math.floor(
    power + kills * Number(balanceConfig.powerFormula.kills || 3)
  );
}

module.exports = {
  ...balanceConfig,

  MAX_LEVEL,
  ITEM_LEVELS,

  getRequiredExp,
  getClassBaseStats,
  getClassGrowth,
  getLevelStatGain,
  getBaseStatsByClassLevel,
  getItemScaleByTierIndex,
  getItemPercentScaleByTierIndex,
  capItemPercentStat,
  getShopItemPrice,
  getNearestItemLevel,
  randomBetween,
  randomIntBetween,
  getMonsterReward,
  getBossRewardPenalty,
  getSellMultiplier,
  getCombatRandomBonus,
  calculatePower,
  calculateOverallScore,
};