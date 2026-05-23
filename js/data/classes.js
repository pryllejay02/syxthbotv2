const classes = [
  {
    id: "swordsman",
    name: "Swordsman",
    emoji: "⚔️",
    description: "Balanced melee fighter",
    baseStats: {
      maxHp: 120,
      attack: 14,
      defense: 8,
      dodge: 5,
      crit: 8,
    },
  },
  {
    id: "archer",
    name: "Archer",
    emoji: "🏹",
    description: "High crit ranged attacker",
    baseStats: {
      maxHp: 95,
      attack: 18,
      defense: 5,
      dodge: 12,
      crit: 15,
    },
  },
  {
    id: "assassin",
    name: "Assassin",
    emoji: "🗡️",
    description: "Fast class with high dodge and crit",
    baseStats: {
      maxHp: 85,
      attack: 20,
      defense: 4,
      dodge: 18,
      crit: 22,
    },
  },
  {
    id: "tanker",
    name: "Tanker",
    emoji: "🛡️",
    description: "High HP and defense class",
    baseStats: {
      maxHp: 180,
      attack: 9,
      defense: 15,
      dodge: 3,
      crit: 5,
    },
  },
];

module.exports = classes;