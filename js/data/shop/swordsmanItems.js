const generateClassItems = require("./itemGenerator");

module.exports = generateClassItems({
  classId: "swordsman",

  weapon: {
    name: "Sword",
    emoji: "🗡️",
    stats: {
      attack: 15,
      defense: 0,
      maxHp: 0,
      dodge: 0,
      crit: 1,
    },
  },

  gears: [
    {
      slot: "helmet",
      name: "Helmet",
      type: "Helmet",
      emoji: "⛑️",
      stats: {
        attack: 0,
        defense: 5,
        maxHp: 25,
        dodge: 0,
        crit: 0,
      },
    },
    {
      slot: "armor",
      name: "Armor",
      type: "Armor",
      emoji: "🦺",
      stats: {
        attack: 0,
        defense: 10,
        maxHp: 50,
        dodge: 0,
        crit: 0,
      },
    },
    {
      slot: "gloves",
      name: "Gloves",
      type: "Gloves",
      emoji: "🧤",
      stats: {
        attack: 3,
        defense: 3,
        maxHp: 10,
        dodge: 0,
        crit: 1,
      },
    },
    {
      slot: "pants",
      name: "Pants",
      type: "Pants",
      emoji: "👖",
      stats: {
        attack: 0,
        defense: 6,
        maxHp: 30,
        dodge: 0,
        crit: 0,
      },
    },
    {
      slot: "boots",
      name: "Boots",
      type: "Boots",
      emoji: "🥾",
      stats: {
        attack: 0,
        defense: 4,
        maxHp: 20,
        dodge: 1,
        crit: 0,
      },
    },
  ],
});