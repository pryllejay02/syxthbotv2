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

  // NEW STATS
  let dodge = Number(baseStats.dodge || 0);
  let crit = Number(baseStats.crit || 0);

  Object.values(equipment).forEach((item) => {
    if (!item || !item.stats) return;

    attack += Number(item.stats.attack || 0);
    defense += Number(item.stats.defense || 0);
    maxHp += Number(item.stats.maxHp || 0);

    // NEW
    dodge += Number(item.stats.dodge || 0);
    crit += Number(item.stats.crit || 0);
  });

  // safety limits
dodge = Number(Math.min(dodge, 80).toFixed(2));
crit = Number(Math.min(crit, 100).toFixed(2));

  return {
    attack,
    defense,
    maxHp,
    dodge,
    crit,
  };
}

module.exports = {
  getDefaultEquipment,
  calculateTotalStats,
};