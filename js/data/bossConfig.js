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

  rankingDeleteMinutes: 10,

  // Boss will automatically disappear if not defeated
  bossExpireMinutes: 120,

  participationRewards: {
    rareChance: 30,
  },

  rankingRewards: {
    top1: {
      legendaryChance: 20,
    },

    top2to5: {
      legendaryChance: 10,
    },

    top6to10: {
      legendaryChance: 5,
    },
  },

  partyBonus: {
    legendaryChance: 5,
    gold: 5,
    exp: 5,
  },
};