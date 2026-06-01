const path = require("path");
const balanceConfig = require("./balanceConfig");

module.exports = {
  spawnSchedule: [
    {
      time: "12:00",
      tier: "beginner",
    },
    {
      time: "18:00",
      tier: "intermediate",
    },
    {
      time: "21:00",
      tier: "advanced",
    },
  ],

  bosses: {
    beginner: [
      {
        id: "goblin_king",
        name: "Goblin King",

        image: path.join(
          __dirname,
          "../../img/boss_img/Goblin_King.png"
        ),

        level: 10,

        hp: 10000,
        attack: 50,
        defense: 20,

        recommendedLevel: {
          min: 5,
          max: 20,
        },

        rewards: {
          gold: 500,
          exp: 250,
        },
      },

      {
        id: "slime_emperor",
        name: "Slime Emperor",

        image: path.join(
          __dirname,
          "../../img/boss_img/Slime_Emperor.png"
        ),

        level: 15,

        hp: 15000,
        attack: 70,
        defense: 30,

        recommendedLevel: {
          min: 5,
          max: 20,
        },

        rewards: {
          gold: 700,
          exp: 350,
        },
      },
    ],

    intermediate: [
      {
        id: "orc_commander",
        name: "Orc Commander",

        image: path.join(
          __dirname,
          "../../img/boss_img/Orc_Commander.png"
        ),

        level: 35,

        hp: 50000,
        attack: 120,
        defense: 60,

        recommendedLevel: {
          min: 25,
          max: 45,
        },

        rewards: {
          gold: 1500,
          exp: 700,
        },
      },
    ],

    advanced: [
      {
        id: "chaos_titan",
        name: "Chaos Titan",

        image: path.join(
          __dirname,
          "../../img/boss_img/Chaos_Titan.png"
        ),

        level: 80,

        hp: 300000,
        attack: 500,
        defense: 250,

        recommendedLevel: {
          min: 70,
          max: 90,
        },

        rewards: {
          gold: 5000,
          exp: 3000,
        },
      },
    ],
  },

  rankingDeleteMinutes: Number(
    balanceConfig.boss?.rankingDeleteMinutes || 10
  ),

  // Boss will automatically disappear if not defeated.
  bossExpireMinutes: Number(
    balanceConfig.boss?.bossExpireMinutes || 120
  ),

  participationRewards: {
    rareChance: Number(
      balanceConfig.boss?.participationRareChance || 25
    ),
  },

  rankingRewards: {
    top1: {
      legendaryChance: Number(
        balanceConfig.boss?.legendaryChance?.top1 || 12
      ),
    },

    top2to5: {
      legendaryChance: Number(
        balanceConfig.boss?.legendaryChance?.top2to5 || 7
      ),
    },

    top6to10: {
      legendaryChance: Number(
        balanceConfig.boss?.legendaryChance?.top6to10 || 3
      ),
    },
  },

  partyBonus: {
    legendaryChance: Number(
      balanceConfig.boss?.partyBonus?.legendaryChance || 3
    ),
    gold: Number(
      balanceConfig.boss?.partyBonus?.gold || 5
    ),
    exp: Number(
      balanceConfig.boss?.partyBonus?.exp || 5
    ),
  },
};