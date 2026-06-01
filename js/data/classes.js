const balanceConfig = require("./balanceConfig");

const classes = [
  {
    id: "swordsman",
    name: "Swordsman",
    emoji: "⚔️",
    description: "Balanced melee fighter",
    baseStats: balanceConfig.getClassBaseStats("swordsman"),
  },
  {
    id: "archer",
    name: "Archer",
    emoji: "🏹",
    description: "High crit ranged attacker",
    baseStats: balanceConfig.getClassBaseStats("archer"),
  },
  {
    id: "assassin",
    name: "Assassin",
    emoji: "🗡️",
    description: "Fast class with high dodge and crit",
    baseStats: balanceConfig.getClassBaseStats("assassin"),
  },
  {
    id: "tanker",
    name: "Tanker",
    emoji: "🛡️",
    description: "High HP and defense class",
    baseStats: balanceConfig.getClassBaseStats("tanker"),
  },
];

module.exports = classes;