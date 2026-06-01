const generateClassItems = require("./itemGenerator");

module.exports = generateClassItems({
  classId: "archer",

  weapon: {
    name: "Bow",
    emoji: "🏹",
    stats: {
      attack: 18,
      defense: 0,
      maxHp: 0,
      dodge: 1,
      crit: 2,
    },
  },

  gears: [
    {
      slot: "helmet",
      name: "Hood",
      type: "Helmet",
      emoji: "⛑️",
      stats: {
        attack: 0,
        defense: 3,
        maxHp: 18,
        dodge: 1,
        crit: 1,
      },
    },
    {
      slot: "armor",
      name: "Leather Armor",
      type: "Armor",
      emoji: "🦺",
      stats: {
        attack: 0,
        defense: 7,
        maxHp: 35,
        dodge: 1,
        crit: 1,
      },
    },
    {
      slot: "gloves",
      name: "Archer Gloves",
      type: "Gloves",
      emoji: "🧤",
      stats: {
        attack: 5,
        defense: 2,
        maxHp: 8,
        dodge: 1,
        crit: 2,
      },
    },
    {
      slot: "pants",
      name: "Leather Pants",
      type: "Pants",
      emoji: "👖",
      stats: {
        attack: 0,
        defense: 4,
        maxHp: 20,
        dodge: 1,
        crit: 0,
      },
    },
    {
      slot: "boots",
      name: "Swift Boots",
      type: "Boots",
      emoji: "🥾",
      stats: {
        attack: 0,
        defense: 3,
        maxHp: 15,
        dodge: 2,
        crit: 0,
      },
    },
  ],
});