const balanceConfig = require("../data/balanceConfig");

const MAX_LEVEL = Number(
  balanceConfig.MAX_LEVEL || balanceConfig.maxLevel || 99
);

function getRequiredExp(level) {
  return balanceConfig.getRequiredExp(level);
}

function getStatsGain(level, classId = "swordsman") {
  return balanceConfig.getLevelStatGain(classId, level);
}

function normalizeBaseStats(baseStats = {}) {
  return {
    attack: Number(baseStats.attack || 10),
    defense: Number(baseStats.defense || 5),
    maxHp: Number(baseStats.maxHp || 100),
    dodge: Number(baseStats.dodge || 0),
    crit: Number(baseStats.crit || 0),
  };
}

function getStartingBaseStats(player, level) {
  if (player.baseStats) {
    return normalizeBaseStats(player.baseStats);
  }

  return balanceConfig.getBaseStatsByClassLevel(
    player.classId || "swordsman",
    Number(level || 1)
  );
}

function applyLevelUp(player, gainedExp) {
  let level = Number(player.level || 1);
  let exp = Number(player.exp || 0) + Number(gainedExp || 0);

  const classId = player.classId || "swordsman";
  const baseStats = getStartingBaseStats(player, level);

  let baseAttack = Number(baseStats.attack || 10);
  let baseDefense = Number(baseStats.defense || 5);
  let baseMaxHp = Number(baseStats.maxHp || 100);
  let baseDodge = Number(baseStats.dodge || 0);
  let baseCrit = Number(baseStats.crit || 0);

  let leveledUp = false;
  let levelUps = 0;

  while (level < MAX_LEVEL && exp >= getRequiredExp(level)) {
    exp -= getRequiredExp(level);
    level++;
    levelUps++;
    leveledUp = true;

    const gain = getStatsGain(level, classId);

    baseAttack += Number(gain.attack || 0);
    baseDefense += Number(gain.defense || 0);
    baseMaxHp += Number(gain.maxHp || 0);
    baseDodge += Number(gain.dodge || 0);
    baseCrit += Number(gain.crit || 0);
  }

  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    exp = 0;
  }

  return {
    level,
    exp,
    baseStats: {
      attack: Math.floor(baseAttack),
      defense: Math.floor(baseDefense),
      maxHp: Math.floor(baseMaxHp),
      dodge: Number(baseDodge.toFixed(2)),
      crit: Number(baseCrit.toFixed(2)),
    },
    leveledUp,
    levelUps,
    nextLevelExp: getRequiredExp(level),
  };
}

module.exports = {
  MAX_LEVEL,
  getRequiredExp,
  getStatsGain,
  applyLevelUp,
};