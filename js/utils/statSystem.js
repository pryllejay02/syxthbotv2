const balanceConfig = require("../data/balanceConfig");

const EQUIPMENT_SLOTS = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "pants",
  "boots",
];

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

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  if (Number.isNaN(number)) return fallback;

  return number;
}

function normalizeStats(stats = {}) {
  return {
    attack: safeNumber(stats.attack, 0),
    defense: safeNumber(stats.defense, 0),
    maxHp: safeNumber(stats.maxHp, 0),
    dodge: safeNumber(stats.dodge, 0),
    crit: safeNumber(stats.crit, 0),
  };
}

function getStatCaps() {
  return {
    dodge: Number(balanceConfig.statCaps?.dodge || 50),
    crit: Number(balanceConfig.statCaps?.crit || 65),
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

  let attack = safeNumber(safeBaseStats.attack, 10);
  let defense = safeNumber(safeBaseStats.defense, 5);
  let maxHp = safeNumber(safeBaseStats.maxHp, 100);

  let dodge = safeNumber(safeBaseStats.dodge, 0);
  let crit = safeNumber(safeBaseStats.crit, 0);

  const safeEquipment = {
    ...getDefaultEquipment(),
    ...(equipment || {}),
  };

  EQUIPMENT_SLOTS.forEach((slot) => {
    const item = safeEquipment[slot];

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
  EQUIPMENT_SLOTS,
  getDefaultEquipment,
  getDefaultStats,
  normalizeStats,
  getStatCaps,
  calculateTotalStats,
};