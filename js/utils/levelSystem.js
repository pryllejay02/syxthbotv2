const MAX_LEVEL = 99;

function getRequiredExp(level) {
  if (level >= MAX_LEVEL) return Infinity;

  if (level <= 20) {
    return Math.floor(50 + level * 35 + level * level * 8);
  }

  if (level <= 50) {
    return Math.floor(300 + level * 80 + level * level * 18);
  }

  if (level <= 80) {
    return Math.floor(1000 + level * 120 + level * level * 25);
  }

  return Math.floor(2500 + level * 180 + level * level * 35);
}

function getStatsGain(level) {
  if (level <= 20) {
    return {
      maxHp: 12,
      attack: 3,
      defense: 2,
      dodge: 0.2,
      crit: 0.2,
    };
  }

  if (level <= 50) {
    return {
      maxHp: 18,
      attack: 4,
      defense: 3,
      dodge: 0.15,
      crit: 0.15,
    };
  }

  if (level <= 80) {
    return {
      maxHp: 25,
      attack: 6,
      defense: 4,
      dodge: 0.1,
      crit: 0.1,
    };
  }

  return {
    maxHp: 35,
    attack: 8,
    defense: 6,
    dodge: 0.05,
    crit: 0.05,
  };
}

function applyLevelUp(player, gainedExp) {
  let level = Number(player.level || 1);
  let exp = Number(player.exp || 0) + Number(gainedExp || 0);

  const baseStats = player.baseStats || {
    attack: 10,
    defense: 5,
    maxHp: 100,
    dodge: 0,
    crit: 0,
  };

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

    const gain = getStatsGain(level);

    baseAttack += gain.attack;
    baseDefense += gain.defense;
    baseMaxHp += gain.maxHp;
    baseDodge += gain.dodge;
    baseCrit += gain.crit;
  }

  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    exp = 0;
  }

  return {
    level,
    exp,
    baseStats: {
      attack: baseAttack,
      defense: baseDefense,
      maxHp: baseMaxHp,
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