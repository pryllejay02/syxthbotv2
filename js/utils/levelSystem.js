const MAX_LEVEL = 99;

function getRequiredExp(level) {
  if (level >= MAX_LEVEL) return Infinity;

  // Easier leveling from Lv.1 to Lv.20
  if (level <= 20) {
    return Math.floor(50 + level * 35 + level * level * 8);
  }

  // Medium grind from Lv.21 to Lv.50
  if (level <= 50) {
    return Math.floor(300 + level * 80 + level * level * 18);
  }

  // Harder grind from Lv.51 to Lv.80
  if (level <= 80) {
    return Math.floor(1000 + level * 120 + level * level * 25);
  }

  // End-game grind from Lv.81 to Lv.99
  return Math.floor(2500 + level * 180 + level * level * 35);
}

function getStatsGain(level) {
  if (level <= 20) {
    return {
      maxHp: 12,
      attack: 3,
      defense: 2,
    };
  }

  if (level <= 50) {
    return {
      maxHp: 18,
      attack: 4,
      defense: 3,
    };
  }

  if (level <= 80) {
    return {
      maxHp: 25,
      attack: 6,
      defense: 4,
    };
  }

  return {
    maxHp: 35,
    attack: 8,
    defense: 6,
  };
}

function applyLevelUp(player, gainedExp) {
  let level = player.level || 1;
  let exp = (player.exp || 0) + gainedExp;

  let maxHp = player.maxHp || 100;
  let attack = player.attack || 10;
  let defense = player.defense || 5;

  let leveledUp = false;
  let levelUps = 0;

  while (level < MAX_LEVEL && exp >= getRequiredExp(level)) {
    exp -= getRequiredExp(level);
    level++;
    levelUps++;
    leveledUp = true;

    const gain = getStatsGain(level);

    maxHp += gain.maxHp;
    attack += gain.attack;
    defense += gain.defense;
  }

  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    exp = 0;
  }

  return {
    level,
    exp,
    maxHp,
    hp: maxHp,
    attack,
    defense,
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