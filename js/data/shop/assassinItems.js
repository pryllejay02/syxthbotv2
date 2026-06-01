const generateClassItems = require("./itemGenerator");

module.exports = generateClassItems({
  classId: "assassin",

  weapon: {
    name: "Dagger",
    emoji: "🗡️",
    stats: {
      attack: 20,
      defense: 0,
      maxHp: 0,
      dodge: 2,
      crit: 3,
    },
  },

  gears: [
    {
      slot: "helmet",
      name: "Shadow Mask",
      type: "Helmet",
      emoji: "⛑️",
      stats: {
        attack: 1,
        defense: 2,
        maxHp: 12,
        dodge: 2,
        crit: 1,
      },
    },
    {
      slot: "armor",
      name: "Shadow Armor",
      type: "Armor",
      emoji: "🦺",
      stats: {
        attack: 0,
        defense: 5,
        maxHp: 25,
        dodge: 2,
        crit: 2,
      },
    },
    {
      slot: "gloves",
      name: "Assassin Gloves",
      type: "Gloves",
      emoji: "🧤",
      stats: {
        attack: 6,
        defense: 2,
        maxHp: 6,
        dodge: 2,
        crit: 3,
      },
    },
    {
      slot: "pants",
      name: "Shadow Pants",
      type: "Pants",
      emoji: "👖",
      stats: {
        attack: 0,
        defense: 3,
        maxHp: 18,
        dodge: 2,
        crit: 1,
      },
    },
    {
      slot: "boots",
      name: "Silent Boots",
      type: "Boots",
      emoji: "🥾",
      stats: {
        attack: 0,
        defense: 2,
        maxHp: 12,
        dodge: 3,
        crit: 1,
      },
    },
  ],
});