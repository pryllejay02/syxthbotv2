const path = require("path");
const balanceConfig = require("./balanceConfig");

function getBossSetting(pathValue, fallback) {
  return Number(pathValue ?? fallback);
}

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

        // Rebalanced beginner boss.
        hp: 6500,
        attack: 45,
        defense: 18,
        dodge: 3,
        crit: 5,

        recommendedLevel: {
          min: 5,
          max: 20,
        },

        rewards: {
          gold: 450,
          exp: 300,
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

        // Slightly tankier than Goblin King, but still beginner-safe.
        hp: 9000,
        attack: 60,
        defense: 24,
        dodge: 2,
        crit: 4,

        recommendedLevel: {
          min: 8,
          max: 22,
        },

        rewards: {
          gold: 650,
          exp: 450,
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

        // Rebalanced for mid-game parties.
        hp: 35000,
        attack: 120,
        defense: 55,
        dodge: 6,
        crit: 9,

        recommendedLevel: {
          min: 25,
          max: 45,
        },

        rewards: {
          gold: 1500,
          exp: 900,
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

        // Rebalanced from 300000 HP / 500 ATK / 250 DEF.
        // Still strong, but no longer too punishing after item/stat rebalance.
        hp: 180000,
        attack: 360,
        defense: 170,
        dodge: 10,
        crit: 15,

        recommendedLevel: {
          min: 70,
          max: 90,
        },

        rewards: {
          gold: 4500,
          exp: 2800,
        },
      },
    ],
  },

  rankingDeleteMinutes: getBossSetting(
    balanceConfig.boss?.rankingDeleteMinutes,
    10
  ),

  // Boss will automatically disappear if not defeated.
  bossExpireMinutes: getBossSetting(
    balanceConfig.boss?.bossExpireMinutes,
    120
  ),

  participationRewards: {
    rareChance: getBossSetting(
      balanceConfig.boss?.participationRareChance,
      25
    ),
  },

  rankingRewards: {
    top1: {
      legendaryChance: getBossSetting(
        balanceConfig.boss?.legendaryChance?.top1,
        12
      ),
    },

    top2to5: {
      legendaryChance: getBossSetting(
        balanceConfig.boss?.legendaryChance?.top2to5,
        7
      ),
    },

    top6to10: {
      legendaryChance: getBossSetting(
        balanceConfig.boss?.legendaryChance?.top6to10,
        3
      ),
    },
  },

  partyBonus: {
    legendaryChance: getBossSetting(
      balanceConfig.boss?.partyBonus?.legendaryChance,
      3
    ),

    gold: getBossSetting(
      balanceConfig.boss?.partyBonus?.gold,
      5
    ),

    exp: getBossSetting(
      balanceConfig.boss?.partyBonus?.exp,
      5
    ),
  },
};