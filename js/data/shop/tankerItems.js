const generateClassItems = require("./itemGenerator");

module.exports = generateClassItems({
  classId: "tanker",

  weapon: {
    name: "Shield",
    emoji: "🛡️",
    stats: {
      attack: 8,
      defense: 8,
      maxHp: 40,
      dodge: 0,
      crit: 0,
    },
  },

  gears: [
    {
      slot: "helmet",
      name: "Heavy Helmet",
      type: "Helmet",
      emoji: "⛑️",
      stats: {
        attack: 0,
        defense: 8,
        maxHp: 45,
        dodge: 0,
        crit: 0,
      },
    },
    {
      slot: "armor",
      name: "Heavy Armor",
      type: "Armor",
      emoji: "🦺",
      stats: {
        attack: 0,
        defense: 16,
        maxHp: 90,
        dodge: 0,
        crit: 0,
      },
    },
    {
      slot: "gloves",
      name: "Heavy Gloves",
      type: "Gloves",
      emoji: "🧤",
      stats: {
        attack: 2,
        defense: 6,
        maxHp: 25,
        dodge: 0,
        crit: 0,
      },
    },
    {
      slot: "pants",
      name: "Heavy Pants",
      type: "Pants",
      emoji: "👖",
      stats: {
        attack: 0,
        defense: 10,
        maxHp: 55,
        dodge: 0,
        crit: 0,
      },
    },
    {
      slot: "boots",
      name: "Heavy Boots",
      type: "Boots",
      emoji: "🥾",
      stats: {
        attack: 0,
        defense: 7,
        maxHp: 40,
        dodge: 0,
        crit: 0,
      },
    },
  ],
});