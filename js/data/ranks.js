const ranks = [
  { level: 99, name: "👑 Eternal Legend" },
  { level: 80, name: "🐉 Dragon Slayer" },
  { level: 70, name: "🔥 Mythic Champion" },
  { level: 60, name: "⚔️ Warlord" },
  { level: 50, name: "🛡️ Elite Knight" },
  { level: 40, name: "🌑 Shadow Warrior" },
  { level: 30, name: "🏹 Veteran Adventurer" },
  { level: 20, name: "⚒️ Skilled Fighter" },
  { level: 10, name: "🧭 Adventurer" },
  { level: 1, name: "🌱 Beginner Adventurer" },
];

function getPlayerRank(level) {
  return ranks.find((rank) => level >= rank.level)?.name || "🌱 Beginner Adventurer";
}

module.exports = {
  ranks,
  getPlayerRank,
};