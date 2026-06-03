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

  statCaps: {
    dodge: 50,
    crit: 65,
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
      Common: 0.45,
      Rare: 0.65,
      Legendary: 0.8,
      default: 0.45,
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
      max: 6,
    },

    raidPlayerHitRandomBonus: {
      min: 5,
      max: 15,
    },

    raidBossHitRandomBonus: {
      min: 8,
      max: 22,
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
    pet: 2500,
  },

  powerFormula: {
    attack: 1,
    defense: 1.35,
    maxHp: 0.16,
    dodge: 4.5,
    crit: 4.5,
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
        max: 1.04,
      },

      Rare: {
        min: 1.12,
        max: 1.24,
      },

      Legendary: {
        min: 1.35,
        max: 1.6,
      },
    },

    statCaps: {
      Common: {
        dodge: 2,
        crit: 3,
      },

      Rare: {
        dodge: 3.5,
        crit: 4.5,
      },

      Legendary: {
        dodge: 5.5,
        crit: 7,
      },
    },

    priceMultiplier: {
      Common: 1,
      Rare: 1.7,
      Legendary: 3.8,
    },
  },

  classBaseStats: {
    swordsman: {
      maxHp: 130,
      attack: 15,
      defense: 9,
      dodge: 4,
      crit: 6,
    },

    archer: {
      maxHp: 95,
      attack: 18,
      defense: 5,
      dodge: 6,
      crit: 8,
    },

    assassin: {
      maxHp: 85,
      attack: 20,
      defense: 4,
      dodge: 8,
      crit: 10,
    },

    tanker: {
      maxHp: 155,
      attack: 10,
      defense: 14,
      dodge: 2,
      crit: 3,
    },
  },

  classGrowth: {
    swordsman: {
      maxHp: 13,
      attack: 2.8,
      defense: 1.9,
      dodge: 0.035,
      crit: 0.045,
    },

    archer: {
      maxHp: 10,
      attack: 3.0,
      defense: 1.1,
      dodge: 0.045,
      crit: 0.065,
    },

    assassin: {
      maxHp: 8,
      attack: 3.2,
      defense: 0.85,
      dodge: 0.055,
      crit: 0.08,
    },

    tanker: {
      maxHp: 14,
      attack: 2.1,
      defense: 2.5,
      dodge: 0.015,
      crit: 0.02,
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
      statMultiplier: 1.2,
      priceMultiplier: 1.7,
    },

    Legendary: {
      emoji: "🟠",
      color: "#F59E0B",
      statMultiplier: 1.55,
      priceMultiplier: 3.8,
    },
  },

  item: {
    levels: ITEM_LEVELS,

    scalePerTier: 0.38,
    percentScalePerTier: 0.03,

    statCaps: {
      dodge: 2,
      crit: 3,
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

    expFormula(level) {
      const lv = Number(level || 1);

      return Math.floor(35 + lv * 12 + lv * lv * 0.65);
    },

    goldFormula(level) {
      const lv = Number(level || 1);

      return Math.floor(25 + lv * 7 + lv * lv * 0.28);
    },
  },

  monsterStats: {
    dodgeCap: 22,
    critCap: 27,

    hpFormula(level) {
      const lv = Number(level || 1);

      return Math.floor(25 + lv * 25 + lv * lv * 0.35);
    },

    attackFormula(level) {
      const lv = Number(level || 1);

      return Math.floor(4 + lv * 4.2 + lv * lv * 0.03);
    },

    defenseFormula(level) {
      const lv = Number(level || 1);

      return Math.floor(1 + lv * 2.2 + lv * lv * 0.018);
    },

    dodgeFormula(level) {
      const lv = Number(level || 1);

      return Math.min(22, Number((1 + lv * 0.15).toFixed(1)));
    },

    critFormula(level) {
      const lv = Number(level || 1);

      return Math.min(27, Number((2 + lv * 0.21).toFixed(1)));
    },
  },

  bossStats: {
    dodgeCap: 30,
    critCap: 40,

    hpFormula(level) {
      const lv = Number(level || 1);

      return Math.floor(5500 + lv * 250 + lv * lv * 40);
    },

    attackFormula(level) {
      const lv = Number(level || 1);

      return Math.floor(30 + lv * 2.3 + lv * lv * 0.045);
    },

    defenseFormula(level) {
      const lv = Number(level || 1);

      return Math.floor(10 + lv * 1.2 + lv * lv * 0.02);
    },

    dodgeFormula(level) {
      const lv = Number(level || 1);

      return Math.min(30, Number((2.5 + lv * 0.14).toFixed(1)));
    },

    critFormula(level) {
      const lv = Number(level || 1);

      return Math.min(40, Number((4 + lv * 0.22).toFixed(1)));
    },
  },

  monsterDrop: {
    minLevel: 5,

    rates: {
      rare: 8,
      common: 32,
      none: 60,
    },

    statRolls: {
      Common: {
        min: 1.0,
        max: 1.04,
      },

      Rare: {
        min: 1.12,
        max: 1.24,
      },
    },

    statCaps: {
      Common: {
        dodge: 2.5,
        crit: 3.5,
      },

      Rare: {
        dodge: 3.5,
        crit: 4.8,
      },
    },

    priceMultiplier: {
      Common: 1,
      Rare: 1.6,
    },
  },

  bossDrop: {
    itemLevels: ITEM_LEVELS.map(([level]) => level),

    statRolls: {
      Rare: {
        min: 1.2,
        max: 1.38,
      },

      Legendary: {
        min: 1.45,
        max: 1.7,
      },
    },

    statCaps: {
      Rare: {
        dodge: 4.5,
        crit: 6,
      },

      Legendary: {
        dodge: 5.5,
        crit: 7.5,
      },
    },

    priceMultiplier: {
      Rare: 2,
      Legendary: 4.2,
    },
  },

  pet: {
    maxLevelByQuality: {
      Common: 20,
      Rare: 30,
      Legendary: 40,
    },

    expGain: {
      monsterPercent: 20,
      bossPercent: 15,
    },

    levelScaling: {
      attackPerLevel: 0.25,
      defensePerLevel: 0.2,
      maxHpPerLevel: 2,
      dodgePerLevel: 0.01,
      critPerLevel: 0.015,
    },

    monsterDrop: {
      minLevel: 5,

      // Common pets drop from normal monsters.
      commonChance: 15,

      statRolls: {
        Common: {
          min: 1.0,
          max: 1.08,
        },
      },

      statCaps: {
        Common: {
          attack: 8,
          defense: 6,
          maxHp: 45,
          dodge: 1.5,
          crit: 2,
        },
      },

      priceMultiplier: {
        Common: 1,
      },
    },

    bossDrop: {
      // Rare and Legendary pets drop from boss raids.
      rareChance: 10,
      legendaryChance: 2,

      statRolls: {
        Rare: {
          min: 1.12,
          max: 1.28,
        },

        Legendary: {
          min: 1.35,
          max: 1.6,
        },
      },

      statCaps: {
        Rare: {
          attack: 16,
          defense: 12,
          maxHp: 90,
          dodge: 2.5,
          crit: 3.5,
        },

        Legendary: {
          attack: 28,
          defense: 22,
          maxHp: 150,
          dodge: 4,
          crit: 5.5,
        },
      },

      priceMultiplier: {
        Rare: 2,
        Legendary: 4.5,
      },
    },

    sellMultiplier: {
      Common: 0.45,
      Rare: 0.65,
      Legendary: 0.8,
    },
  },

  boss: {
    rankingDeleteMinutes: 10,
    bossExpireMinutes: 120,

    participationRareChance: 22,

    legendaryChance: {
      top1: 10,
      top2to5: 6,
      top6to10: 3,
    },

    partyBonus: {
      legendaryChance: 2,
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
        dropMultiplier: 0.75,
        legendaryAllowed: true,
        label: "Slightly Reduced",
      },
      {
        maxLevelDifference: 30,
        goldMultiplier: 0.5,
        expMultiplier: 0.5,
        dropMultiplier: 0.35,
        legendaryAllowed: true,
        label: "Reduced",
      },
      {
        maxLevelDifference: 50,
        goldMultiplier: 0.2,
        expMultiplier: 0,
        dropMultiplier: 0.1,
        legendaryAllowed: false,
        label: "Heavily Reduced",
      },
    ],

    rewardPenaltyFallback: {
      goldMultiplier: 0.05,
      expMultiplier: 0,
      dropMultiplier: 0.03,
      legendaryAllowed: false,
      label: "Almost No Reward",
    },
  },
};

function getRequiredExp(level) {
  const lv = Math.max(1, Number(level || 1));

  if (lv >= MAX_LEVEL) return Infinity;

  if (lv <= 10) {
    return Math.floor(45 + lv * 32 + lv * lv * 7);
  }

  if (lv <= 30) {
    return Math.floor(280 + lv * 65 + lv * lv * 15);
  }

  if (lv <= 60) {
    return Math.floor(900 + lv * 115 + lv * lv * 25);
  }

  if (lv <= 90) {
    return Math.floor(2000 + lv * 175 + lv * lv * 40);
  }

  return Math.floor(5500 + lv * 260 + lv * lv * 52);
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
    stageMultiplier = 1.15;
  } else if (lv > 50) {
    stageMultiplier = 1.08;
  } else if (lv > 20) {
    stageMultiplier = 1.03;
  }

  return {
    maxHp: Math.floor(Number(growth.maxHp || 0) * stageMultiplier),
    attack: Number((Number(growth.attack || 0) * stageMultiplier).toFixed(2)),
    defense: Number((Number(growth.defense || 0) * stageMultiplier).toFixed(2)),
    dodge: Number(Number(growth.dodge || 0).toFixed(3)),
    crit: Number(Number(growth.crit || 0).toFixed(3)),
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
    (1 + safeIndex * Number(balanceConfig.item.scalePerTier || 0.38)).toFixed(2)
  );
}

function getItemPercentScaleByTierIndex(index) {
  const safeIndex = Math.max(0, Number(index || 0));

  return Number(
    (
      1 +
      safeIndex * Number(balanceConfig.item.percentScalePerTier || 0.03)
    ).toFixed(2)
  );
}

function capItemPercentStat(
  statName,
  value,
  quality = "Common",
  source = "shop"
) {
  const statValue = Number(value || 0);

  let cap = Number(balanceConfig.item?.statCaps?.[statName] || 0);

  if (source === "monster_drop") {
    cap = Number(
      balanceConfig.monsterDrop?.statCaps?.[quality]?.[statName] || cap
    );
  }

  if (source === "boss_raid") {
    cap = Number(
      balanceConfig.bossDrop?.statCaps?.[quality]?.[statName] || cap
    );
  }

  if (source === "admin_generated" || source === "admin") {
    cap = Number(
      balanceConfig.adminItem?.statCaps?.[quality]?.[statName] || cap
    );
  }

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

function getBalancedMonsterStats(monster = {}) {
  if (monster.statOverride === true) {
    return {
      hp: Number(monster.hp || 1),
      attack: Number(monster.attack || 1),
      defense: Number(monster.defense || 0),
      dodge: Number(monster.dodge || 0),
      crit: Number(monster.crit || 0),
    };
  }

  const level = Number(monster.level || 1);
  const config = balanceConfig.monsterStats;

  return {
    hp: config.hpFormula(level),
    attack: config.attackFormula(level),
    defense: config.defenseFormula(level),
    dodge: config.dodgeFormula(level),
    crit: config.critFormula(level),
  };
}

function getBalancedBossStats(boss = {}) {
  if (boss.statOverride === true) {
    return {
      hp: Number(boss.hp || 1),
      attack: Number(boss.attack || 1),
      defense: Number(boss.defense || 0),
      dodge: Number(boss.dodge || 0),
      crit: Number(boss.crit || 0),
    };
  }

  const level = Number(boss.level || 1);
  const config = balanceConfig.bossStats;

  return {
    hp: config.hpFormula(level),
    attack: config.attackFormula(level),
    defense: config.defenseFormula(level),
    dodge: config.dodgeFormula(level),
    crit: config.critFormula(level),
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
      defense * Number(formula.defense || 1.35) +
      maxHp * Number(formula.maxHp || 0.16) +
      dodge * Number(formula.dodge || 4.5) +
      crit * Number(formula.crit || 4.5) +
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
  getBalancedMonsterStats,
  getBalancedBossStats,
  getBossRewardPenalty,
  getSellMultiplier,
  getCombatRandomBonus,
  calculatePower,
  calculateOverallScore,
};