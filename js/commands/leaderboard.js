const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");

function calculatePower(player) {
  const attack = Number(player.attack || 0);
  const defense = Number(player.defense || 0);
  const maxHp = Number(player.maxHp || 0);
  const dodge = Number(player.dodge || 0);
  const crit = Number(player.crit || 0);

  return Math.floor(
    attack +
    defense * 1.5 +
    maxHp * 0.2 +
    dodge * 10 +
    crit * 10
  );
}

function calculateOverall(player) {
  const power = calculatePower(player);
  const level = Number(player.level || 1);

  return Math.floor(
    power +
    (level * 100)
  );
}

module.exports = async function leaderboardCommand(message) {
  const snapshot = await db
    .collection("players")
    .get();

  if (snapshot.empty) {
    return message.reply(
      "❌ No players found."
    );
  }

  const players = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  const rankedPlayers = players
    .map(player => ({
      ...player,
      power: calculatePower(player),
      score: calculateOverall(player)
    }))
    .sort(
      (a, b) => b.score - a.score
    )
    .slice(0, 10);

  const leaderboardText = rankedPlayers
    .map((player, index) => {

      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `#${index + 1}`;

      return (
        `${medal} **${player.username}**\n` +
        `⭐ Score: ${player.score}\n` +
        `⚔️ Power: ${player.power}\n` +
        `📈 Lv.${player.level || 1}\n` +
        `❤️ HP: ${player.maxHp || 0}\n` +
        `🛡️ DEF: ${player.defense || 0}`
      );

    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("🏆 SYXTH OVERALL LEADERBOARD")
    .setDescription(
      `Top adventurers across all worlds\n\n` +
      leaderboardText
    )
    .setFooter({
      text: "Syxth MMORPG Rankings"
    });

  return message.reply({
    embeds: [embed]
  });
};