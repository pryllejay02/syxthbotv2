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
  const kills = Number(player.monsterKills || 0);

  return Math.floor(
    power +
      level * 100 +
      kills * 3
  );
}

function getMedal(index) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

function getLeaderboardConfig(type) {
  const normalized = String(type || "overall").toLowerCase();

  const configs = {
    overall: {
      title: "🏆 SYXTH OVERALL LEADERBOARD",
      description: "Top adventurers based on level, power, and monster kills.",
      getScore: calculateOverall,
      scoreLabel: "Score",
    },

    power: {
      title: "⚔️ SYXTH POWER LEADERBOARD",
      description: "Strongest adventurers based on combat stats.",
      getScore: calculatePower,
      scoreLabel: "Power",
    },

    level: {
      title: "⭐ SYXTH LEVEL LEADERBOARD",
      description: "Highest-level adventurers.",
      getScore: (player) => Number(player.level || 1),
      scoreLabel: "Level",
    },

    kills: {
      title: "👹 SYXTH MONSTER KILLS LEADERBOARD",
      description: "Most active monster hunters.",
      getScore: (player) => Number(player.monsterKills || 0),
      scoreLabel: "Kills",
    },

    gold: {
      title: "🪙 SYXTH GOLD LEADERBOARD",
      description: "Richest adventurers.",
      getScore: (player) => Number(player.gold || 0),
      scoreLabel: "Gold",
    },
  };

  return configs[normalized] || configs.overall;
}

module.exports = async function leaderboardCommand(message, args = []) {
  const type = String(args[0] || "overall").toLowerCase();

  const validTypes = ["overall", "power", "level", "kills", "gold"];

  if (!validTypes.includes(type)) {
    return message.reply(
      "❌ Invalid leaderboard type.\n\n" +
        "Use:\n" +
        "`!s leaderboard overall`\n" +
        "`!s leaderboard power`\n" +
        "`!s leaderboard level`\n" +
        "`!s leaderboard kills`\n" +
        "`!s leaderboard gold`"
    );
  }

  const snapshot = await db
    .collection("players")
    .get();

  if (snapshot.empty) {
    return message.reply("❌ No players found.");
  }

  const config = getLeaderboardConfig(type);

  const players = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((player) => player.username);

  const rankedPlayers = players
    .map((player) => ({
      ...player,
      power: calculatePower(player),
      overallScore: calculateOverall(player),
      leaderboardScore: config.getScore(player),
    }))
    .sort((a, b) => b.leaderboardScore - a.leaderboardScore)
    .slice(0, 10);

  if (rankedPlayers.length === 0) {
    return message.reply("❌ No valid players found.");
  }

  const leaderboardText = rankedPlayers
    .map((player, index) => {
      const medal = getMedal(index);

      return (
        `${medal} **${player.username}**\n` +
        `🏅 ${config.scoreLabel}: **${player.leaderboardScore}**\n` +
        `⭐ Level: **${player.level || 1}**\n` +
        `⚔️ Power: **${player.power}**\n` +
        `👹 Kills: **${player.monsterKills || 0}**\n` +
        `🪙 Gold: **${player.gold || 0}**\n` +
        `🌍 World: **${player.world?.name || "Unknown"}**`
      );
    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle(config.title)
    .setDescription(
      `${config.description}\n\n` +
        leaderboardText +
        `\n\n━━━━━━━━━━━━━━━━━━\n` +
        `Other rankings:\n` +
        "`!s leaderboard overall`\n" +
        "`!s leaderboard power`\n" +
        "`!s leaderboard level`\n" +
        "`!s leaderboard kills`\n" +
        "`!s leaderboard gold`"
    )
    .setFooter({
      text: "Syxth MMORPG Rankings",
    });

  return message.reply({
    embeds: [embed],
  });
};