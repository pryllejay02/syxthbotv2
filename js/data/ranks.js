const ranks = [
  {
    level: 99,
    name: "👑 Eternal Legend",
  },
  {
    level: 80,
    name: "🐉 Dragon Slayer",
  },
  {
    level: 70,
    name: "🔥 Mythic Champion",
  },
  {
    level: 60,
    name: "⚔️ Warlord",
  },
  {
    level: 50,
    name: "🛡️ Elite Knight",
  },
  {
    level: 40,
    name: "🌑 Shadow Warrior",
  },
  {
    level: 30,
    name: "🏹 Veteran Adventurer",
  },
  {
    level: 20,
    name: "⚒️ Skilled Fighter",
  },
  {
    level: 10,
    name: "🧭 Adventurer",
  },
  {
    level: 1,
    name: "🌱 Beginner Adventurer",
  },
];

function getPlayerRank(level = 1) {
  const playerLevel = Number(level || 1);

  return (
    ranks.find((rank) => playerLevel >= Number(rank.level || 1))?.name ||
    "🌱 Beginner Adventurer"
  );
}

function getNextRank(level = 1) {
  const playerLevel = Number(level || 1);

  const ascendingRanks = [...ranks].sort(
    (a, b) => Number(a.level || 1) - Number(b.level || 1)
  );

  return (
    ascendingRanks.find((rank) => Number(rank.level || 1) > playerLevel) ||
    null
  );
}

function getRankProgress(level = 1) {
  const playerLevel = Number(level || 1);

  const currentRank =
    ranks.find((rank) => playerLevel >= Number(rank.level || 1)) ||
    ranks[ranks.length - 1];

  const nextRank = getNextRank(playerLevel);

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progressText: "Max Rank",
    };
  }

  const levelsNeeded = Number(nextRank.level || 1) - playerLevel;

  return {
    currentRank,
    nextRank,
    levelsNeeded,
    progressText: `${levelsNeeded} level(s) until ${nextRank.name}`,
  };
}

module.exports = {
  ranks,
  getPlayerRank,
  getNextRank,
  getRankProgress,
};