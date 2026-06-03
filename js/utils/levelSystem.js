const balanceConfig = require("../data/balanceConfig");

const MAX_LEVEL = Number(
  balanceConfig.MAX_LEVEL || balanceConfig.maxLevel || 99
);

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  if (Number.isNaN(number)) return fallback;

  return number;
}

function normalizeClassId(classId = "swordsman") {
  return String(classId || "swordsman").toLowerCase().trim();
}

function isMaxLevel(level) {
  return Number(level || 1) >= MAX_LEVEL;
}

function getRequiredExp(level) {
  if (typeof balanceConfig.getRequiredExp === "function") {
    return balanceConfig.getRequiredExp(level);
  }

  const lv = Math.max(1, safeNumber(level, 1));

  if (lv >= MAX_LEVEL) return Infinity;

  return Math.floor(45 + lv * 32 + lv * lv * 7);
}

function getStatsGain(level, classId = "swordsman") {
  const normalizedClassId = normalizeClassId(classId);

  if (typeof balanceConfig.getLevelStatGain === "function") {
    return balanceConfig.getLevelStatGain(normalizedClassId, level);
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
  const normalizedClassId = normalizeClassId(classId);
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, safeNumber(level, 1)));

  if (typeof balanceConfig.getBaseStatsByClassLevel === "function") {
    return balanceConfig.getBaseStatsByClassLevel(normalizedClassId, safeLevel);
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
    attack: Math.floor(safeNumber(baseStats.attack, 10)),
    defense: Math.floor(safeNumber(baseStats.defense, 5)),
    maxHp: Math.floor(safeNumber(baseStats.maxHp, 100)),
    dodge: Number(safeNumber(baseStats.dodge, 0).toFixed(2)),
    crit: Number(safeNumber(baseStats.crit, 0).toFixed(2)),
  };
}

function applyLevelUp(player = {}, gainedExp = 0) {
  let level = safeNumber(player.level, 1);
  let exp = safeNumber(player.exp, 0) + safeNumber(gainedExp, 0);

  const classId = normalizeClassId(player.classId || "swordsman");

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
    nextLevelExp: isMaxLevel(level) ? null : getRequiredExp(level),
    maxLevel: MAX_LEVEL,
    isMaxLevel: isMaxLevel(level),
  };
}

module.exports = {
  MAX_LEVEL,
  isMaxLevel,
  getRequiredExp,
  getStatsGain,
  normalizeBaseStats,
  getBaseStatsByClassLevel,
  applyLevelUp,
};