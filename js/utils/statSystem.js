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

function calculateTotalStats(
  baseStats,
  equipment = getDefaultEquipment()
) {
  let attack = Number(baseStats.attack || 10);
  let defense = Number(baseStats.defense || 5);
  let maxHp = Number(baseStats.maxHp || 100);

  let dodge = Number(baseStats.dodge || 0);
  let crit = Number(baseStats.crit || 0);

  Object.values(equipment).forEach((item) => {
    if (!item || !item.stats) return;

    attack += Number(item.stats.attack || 0);
    defense += Number(item.stats.defense || 0);
    maxHp += Number(item.stats.maxHp || 0);

    dodge += Number(item.stats.dodge || 0);
    crit += Number(item.stats.crit || 0);
  });

  const dodgeCap = Number(balanceConfig.statCaps?.dodge || 75);
  const critCap = Number(balanceConfig.statCaps?.crit || 85);

  dodge = Number(Math.min(dodge, dodgeCap).toFixed(2));
  crit = Number(Math.min(crit, critCap).toFixed(2));

  return {
    attack: Math.floor(attack),
    defense: Math.floor(defense),
    maxHp: Math.floor(maxHp),
    dodge,
    crit,
  };
}

module.exports = {
  getDefaultEquipment,
  calculateTotalStats,
};