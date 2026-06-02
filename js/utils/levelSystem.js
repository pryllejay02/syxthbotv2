const balanceConfig = require("../data/balanceConfig");

const MAX_LEVEL = Number(
  balanceConfig.MAX_LEVEL || balanceConfig.maxLevel || 99
);

function getRequiredExp(level) {
  if (typeof balanceConfig.getRequiredExp === "function") {
    return balanceConfig.getRequiredExp(level);
  }

  const lv = Math.max(1, Number(level || 1));

  if (lv >= MAX_LEVEL) return Infinity;

  return Math.floor(45 + lv * 32 + lv * lv * 7);
}

function getStatsGain(level, classId = "swordsman") {
  if (typeof balanceConfig.getLevelStatGain === "function") {
    return balanceConfig.getLevelStatGain(classId, level);
  }

  return {
    attack: 2,
    defense: 1,
    maxHp: 10,
    dodge: 0.02,
    crit: 0.02,
  };
}

function getBaseStatsByClassLevel(classId = "swordsman", level = 1) {
  if (typeof balanceConfig.getBaseStatsByClassLevel === "function") {
    return balanceConfig.getBaseStatsByClassLevel(classId, level);
  }

  return {
    attack: 10,
    defense: 5,
    maxHp: 100,
    dodge: 0,
    crit: 0,
  };
}

function normalizeBaseStats(baseStats = {}) {
  return {
    attack: Math.floor(Number(baseStats.attack || 10)),
    defense: Math.floor(Number(baseStats.defense || 5)),
    maxHp: Math.floor(Number(baseStats.maxHp || 100)),
    dodge: Number(Number(baseStats.dodge || 0).toFixed(2)),
    crit: Number(Number(baseStats.crit || 0).toFixed(2)),
  };
}

function applyLevelUp(player = {}, gainedExp = 0) {
  let level = Number(player.level || 1);
  let exp = Number(player.exp || 0) + Number(gainedExp || 0);

  const classId = player.classId || "swordsman";

  level = Math.max(1, Math.min(level, MAX_LEVEL));
  exp = Math.max(0, exp);

  const oldLevel = level;

  let leveledUp = false;
  let levelUps = 0;

  while (level < MAX_LEVEL && exp >= getRequiredExp(level)) {
    exp -= getRequiredExp(level);
    level++;
    levelUps++;
    leveledUp = true;
  }

  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    exp = 0;
  }

  // Important rebalance fix:
  // Always rebuild baseStats from balanceConfig using the final level.
  // This prevents old pre-rebalance baseStats from staying too high.
  const baseStats = normalizeBaseStats(
    getBaseStatsByClassLevel(classId, level)
  );

  return {
    oldLevel,
    level,
    exp,
    baseStats,
    leveledUp,
    levelUps,
    nextLevelExp: getRequiredExp(level),
  };
}

module.exports = {
  MAX_LEVEL,
  getRequiredExp,
  getStatsGain,
  normalizeBaseStats,
  getBaseStatsByClassLevel,
  applyLevelUp,
};