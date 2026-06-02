const balanceConfig = require("../data/balanceConfig");

function getDefaultEquipment() {
  return {
    weapon: null,
    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };
}

function getDefaultStats() {
  return {
    attack: 10,
    defense: 5,
    maxHp: 100,
    dodge: 0,
    crit: 0,
  };
}

function normalizeStats(stats = {}) {
  return {
    attack: Number(stats.attack || 0),
    defense: Number(stats.defense || 0),
    maxHp: Number(stats.maxHp || 0),
    dodge: Number(stats.dodge || 0),
    crit: Number(stats.crit || 0),
  };
}

function getStatCaps() {
  return {
    dodge: Number(balanceConfig.statCaps?.dodge || 60),
    crit: Number(balanceConfig.statCaps?.crit || 75),
  };
}

function calculateTotalStats(
  baseStats = getDefaultStats(),
  equipment = getDefaultEquipment()
) {
  const safeBaseStats = {
    ...getDefaultStats(),
    ...(baseStats || {}),
  };

  let attack = Number(safeBaseStats.attack || 10);
  let defense = Number(safeBaseStats.defense || 5);
  let maxHp = Number(safeBaseStats.maxHp || 100);

  let dodge = Number(safeBaseStats.dodge || 0);
  let crit = Number(safeBaseStats.crit || 0);

  const safeEquipment = {
    ...getDefaultEquipment(),
    ...(equipment || {}),
  };

  Object.values(safeEquipment).forEach((item) => {
    if (!item || !item.stats) return;

    const itemStats = normalizeStats(item.stats);

    attack += itemStats.attack;
    defense += itemStats.defense;
    maxHp += itemStats.maxHp;

    dodge += itemStats.dodge;
    crit += itemStats.crit;
  });

  const caps = getStatCaps();

  dodge = Number(
    Math.max(0, Math.min(dodge, caps.dodge)).toFixed(2)
  );

  crit = Number(
    Math.max(0, Math.min(crit, caps.crit)).toFixed(2)
  );

  return {
    attack: Math.floor(Math.max(1, attack)),
    defense: Math.floor(Math.max(0, defense)),
    maxHp: Math.floor(Math.max(1, maxHp)),
    dodge,
    crit,
  };
}

module.exports = {
  getDefaultEquipment,
  getDefaultStats,
  normalizeStats,
  getStatCaps,
  calculateTotalStats,
};