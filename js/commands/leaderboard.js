const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");

const EQUIPMENT_SLOTS = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "pants",
  "boots",
];

function getDefaultStats() {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
    dodge: 0,
    crit: 0,
  };
}

function getDefaultEquipment() {
  return {
    weapon: null,
    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };
}

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
}

function getQuality(item = {}) {
  const quality = String(item.quality || "Common");

  if (["Starter", "Common", "Rare", "Legendary"].includes(quality)) {
    return quality;
  }

  return "Common";
}

function getSource(item = {}) {
  return String(item.source || "shop").toLowerCase();
}

function isStarterItem(item = {}) {
  return (
    item.quality === "Starter" ||
    item.source === "starter" ||
    item.isStarter === true
  );
}

function isConsumable(item = {}) {
  return String(item.type || "").toLowerCase() === "consumable";
}

function findBaseShopItem(item = {}) {
  const candidateIds = [item.baseItemId, item.id]
    .filter(Boolean)
    .map(normalizeId);

  for (const candidateId of candidateIds) {
    const exactMatch = shopItems.find(
      (shopItem) => normalizeId(shopItem.id) === candidateId
    );

    if (exactMatch) return exactMatch;
  }

  const itemId = normalizeId(item.id);

  if (!itemId) return null;

  const prefixMatches = shopItems
    .filter((shopItem) => itemId.startsWith(normalizeId(shopItem.id)))
    .sort((a, b) => normalizeId(b.id).length - normalizeId(a.id).length);

  return prefixMatches[0] || null;
}

function getRollConfigBySource(item = {}, quality = "Common") {
  const source = getSource(item);

  if (source === "boss_raid") {
    return balanceConfig.bossDrop?.statRolls?.[quality] || null;
  }

  if (source === "monster_drop") {
    return balanceConfig.monsterDrop?.statRolls?.[quality] || null;
  }

  if (source === "admin_generated" || source === "admin") {
    return balanceConfig.adminItem?.statRolls?.[quality] || null;
  }

  return null;
}

function getDeterministicMultiplier(item = {}, quality = "Common") {
  if (quality === "Starter") return 0;

  const source = getSource(item);

  if (!source || source === "shop") {
    return Number(balanceConfig.quality?.[quality]?.statMultiplier || 1);
  }

  const rollConfig = getRollConfigBySource(item, quality);

  if (rollConfig) {
    const min = Number(rollConfig.min || 1);
    const max = Number(rollConfig.max || min);

    return Number(((min + max) / 2).toFixed(3));
  }

  return Number(balanceConfig.quality?.[quality]?.statMultiplier || 1);
}

function capPercentStat(statName, value, quality = "Common", source = "shop") {
  const statValue = Number(value || 0);

  if (typeof balanceConfig.capItemPercentStat === "function") {
    return balanceConfig.capItemPercentStat(
      statName,
      statValue,
      quality,
      source
    );
  }

  let cap = Number(balanceConfig.item?.statCaps?.[statName] || 0);

  if (source === "monster_drop") {
    cap = Number(
      balanceConfig.monsterDrop?.statCaps?.[quality]?.[statName] || cap
    );
  }

  if (source === "boss_raid") {
    cap = Number(
      balanceConfig.bossDrop?.statCaps?.[quality]?.[statName] || cap
    );
  }

  if (source === "admin_generated" || source === "admin") {
    if (quality === "Rare") {
      cap = Number(
        balanceConfig.monsterDrop?.statCaps?.Rare?.[statName] || cap
      );
    }

    if (quality === "Legendary") {
      cap = Number(
        balanceConfig.bossDrop?.statCaps?.Legendary?.[statName] || cap
      );
    }
  }

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function scaleStats(
  stats = {},
  multiplier = 1,
  quality = "Common",
  source = "shop"
) {
  const attack = Math.floor(Number(stats.attack || 0) * multiplier);
  const defense = Math.floor(Number(stats.defense || 0) * multiplier);
  const maxHp = Math.floor(Number(stats.maxHp || 0) * multiplier);

  const dodge = capPercentStat(
    "dodge",
    Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
    quality,
    source
  );

  const crit = capPercentStat(
    "crit",
    Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
    quality,
    source
  );

  return {
    attack,
    defense,
    maxHp,
    dodge,
    crit,
  };
}

function normalizeFallbackStats(item = {}) {
  const quality = getQuality(item);
  const source = getSource(item);

  return {
    attack: Math.floor(Number(item.stats?.attack || 0)),
    defense: Math.floor(Number(item.stats?.defense || 0)),
    maxHp: Math.floor(Number(item.stats?.maxHp || 0)),
    dodge: capPercentStat(
      "dodge",
      Number(item.stats?.dodge || 0),
      quality,
      source
    ),
    crit: capPercentStat(
      "crit",
      Number(item.stats?.crit || 0),
      quality,
      source
    ),
  };
}

function rebalanceItemStats(item = {}) {
  if (!item) return null;

  const quality = getQuality(item);
  const source = getSource(item);

  if (isStarterItem(item)) {
    return {
      ...item,
      quality: "Starter",
      qualityEmoji: "🌱",
      price: 0,
      source: "starter",
      isStarter: true,
      quantity: 1,
      stats: getDefaultStats(),
    };
  }

  if (isConsumable(item)) {
    return {
      ...item,
      quality,
      quantity: Math.max(1, Number(item.quantity || 1)),
      stats: item.stats || getDefaultStats(),
    };
  }

  const baseItem = findBaseShopItem(item);

  if (!baseItem) {
    return {
      ...item,
      quality,
      quantity: Math.max(1, Number(item.quantity || 1)),
      stats: normalizeFallbackStats(item),
    };
  }

  const multiplier = getDeterministicMultiplier(item, quality);

  const rebalancedStats = scaleStats(
    baseItem.stats || getDefaultStats(),
    multiplier,
    quality,
    source
  );

  return {
    ...item,
    id: item.id || baseItem.id,
    baseItemId: baseItem.id,
    name: item.name || baseItem.name,
    type: baseItem.type || item.type || "Unknown",
    quality,
    requiredLevel: Number(baseItem.requiredLevel || item.requiredLevel || 1),
    compatibleClasses:
      baseItem.compatibleClasses || item.compatibleClasses || ["all"],
    stats: rebalancedStats,
    quantity: 1,
    source,
  };
}

function normalizeEquipment(equipment = {}) {
  const safeEquipment = {
    ...getDefaultEquipment(),
    ...equipment,
  };

  const normalizedEquipment = getDefaultEquipment();

  EQUIPMENT_SLOTS.forEach((slot) => {
    normalizedEquipment[slot] = safeEquipment[slot]
      ? rebalanceItemStats(safeEquipment[slot])
      : null;
  });

  return normalizedEquipment;
}

function getBaseStatsByClassLevel(classId, level) {
  if (typeof balanceConfig.getBaseStatsByClassLevel === "function") {
    return balanceConfig.getBaseStatsByClassLevel(classId, level);
  }

  return {
    attack: 10,
    defense: 5,
    maxHp: 100,
    dodge: 0,
    crit: 0,
  };
}

function getRebalancedPlayer(player = {}) {
  const level = Math.max(1, Number(player.level || 1));
  const classId = player.classId || "swordsman";

  const baseStats = getBaseStatsByClassLevel(classId, level);
  const equipment = normalizeEquipment(player.equipment || {});
  const totalStats = calculateTotalStats(baseStats, equipment);

  const hp = Math.min(
    Math.max(0, Number(player.hp ?? totalStats.maxHp)),
    Number(totalStats.maxHp || 100)
  );

  return {
    ...player,

    level,
    classId,

    baseStats,
    equipment,

    hp,
    maxHp: totalStats.maxHp,
    attack: totalStats.attack,
    defense: totalStats.defense,
    dodge: totalStats.dodge,
    crit: totalStats.crit,
  };
}

function calculatePower(player) {
  return balanceConfig.calculatePower(player);
}

function calculateOverall(player) {
  return balanceConfig.calculateOverallScore(player);
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
      description: "Strongest adventurers based on rebalanced combat stats.",
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

  const snapshot = await db.collection("players").get();

  if (snapshot.empty) {
    return message.reply("❌ No players found.");
  }

  const config = getLeaderboardConfig(type);

  const players = snapshot.docs
    .map((doc) =>
      getRebalancedPlayer({
        id: doc.id,
        ...doc.data(),
      })
    )
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
        `❤️ HP: **${player.hp}/${player.maxHp}**\n` +
        `🛡️ DEF: **${player.defense}**\n` +
        `💨 Dodge: **${Number(player.dodge || 0).toFixed(1)}%**\n` +
        `💥 Crit: **${Number(player.crit || 0).toFixed(1)}%**\n` +
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
      text: "Syxth MMORPG Rankings • Rebalanced Stats",
    });

  return message.reply({
    embeds: [embed],
  });
};