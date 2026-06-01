const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");

const SHOP_LEVELS = [
  1,
  ...balanceConfig.ITEM_LEVELS.map(([level]) => level),
];

function canUseItem(player, item) {
  if (!item.compatibleClasses) return true;
  if (item.compatibleClasses.includes("all")) return true;

  return item.compatibleClasses.includes(player.classId);
}

function getNearestShopLevel(playerLevel) {
  const level = Number(playerLevel || 1);

  let nearest = 1;

  for (const shopLevel of SHOP_LEVELS) {
    if (shopLevel <= level) {
      nearest = shopLevel;
    }
  }

  return nearest;
}

function normalizeTypeFilter(value) {
  const filter = String(value || "all").toLowerCase();

  const validFilters = [
    "all",
    "equipment",
    "weapon",
    "helmet",
    "armor",
    "gloves",
    "pants",
    "boots",
    "consumable",
    "consumables",
  ];

  if (!validFilters.includes(filter)) return null;

  return filter;
}

function matchesTypeFilter(item, filter) {
  const itemType = String(item.type || "").toLowerCase();

  if (filter === "all") return true;

  if (filter === "equipment") {
    return itemType !== "consumable";
  }

  if (filter === "consumable" || filter === "consumables") {
    return itemType === "consumable";
  }

  return itemType === filter;
}

function formatStats(stats = {}) {
  const parts = [];

  if (stats.attack) parts.push(`⚔️ +${stats.attack}`);
  if (stats.defense) parts.push(`🛡️ +${stats.defense}`);
  if (stats.maxHp) parts.push(`❤️ +${stats.maxHp}`);
  if (stats.dodge) parts.push(`💨 +${stats.dodge}%`);
  if (stats.crit) parts.push(`💥 +${stats.crit}%`);

  return parts.length ? parts.join(" • ") : "No stats";
}

function formatClass(classes = []) {
  if (!Array.isArray(classes)) return "All";

  return classes
    .map((cls) => {
      const text = String(cls || "all");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(", ");
}

function getTypeLabel(filter) {
  const labels = {
    all: "All",
    equipment: "Equipment",
    weapon: "Weapons",
    helmet: "Helmets",
    armor: "Armor",
    gloves: "Gloves",
    pants: "Pants",
    boots: "Boots",
    consumable: "Consumables",
    consumables: "Consumables",
  };

  return labels[filter] || "All";
}

function sortShopItems(items = []) {
  const typeOrder = {
    Weapon: 1,
    Helmet: 2,
    Armor: 3,
    Gloves: 4,
    Pants: 5,
    Boots: 6,
    Consumable: 7,
  };

  return [...items].sort((a, b) => {
    const typeA = typeOrder[a.type] || 99;
    const typeB = typeOrder[b.type] || 99;

    if (typeA !== typeB) return typeA - typeB;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

module.exports = async function shopCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();

  const firstArg = String(args[0] || "").toLowerCase();
  const secondArg = String(args[1] || "").toLowerCase();

  let requestedLevel = null;
  let typeFilter = "all";

  if (!firstArg) {
    requestedLevel = getNearestShopLevel(Number(player.level || 1));
  } else if (!Number.isNaN(Number(firstArg))) {
    requestedLevel = Number(firstArg);
    typeFilter = normalizeTypeFilter(secondArg || "all");

    if (!typeFilter) {
      return message.reply(
        "❌ Invalid shop filter.\n\n" +
          "Use: `all`, `equipment`, `weapon`, `helmet`, `armor`, `gloves`, `pants`, `boots`, `consumable`"
      );
    }
  } else {
    requestedLevel = 1;
    typeFilter = normalizeTypeFilter(firstArg);

    if (!typeFilter) {
      return message.reply(
        "❌ Invalid shop command.\n\n" +
          "Examples:\n" +
          "`!s shop`\n" +
          "`!s shop 5`\n" +
          "`!s shop 5 weapon`\n" +
          "`!s shop 5 equipment`\n" +
          "`!s shop consumable`"
      );
    }
  }

  if (!SHOP_LEVELS.includes(requestedLevel)) {
    return message.reply(
      `❌ Invalid shop level: **${requestedLevel}**\n\n` +
        `Available levels:\n` +
        `\`${SHOP_LEVELS.join(" ")}\``
    );
  }

  const filteredItems = sortShopItems(
    shopItems.filter(
      (item) =>
        Number(item.requiredLevel || 1) === requestedLevel &&
        canUseItem(player, item) &&
        matchesTypeFilter(item, typeFilter)
    )
  );

  if (filteredItems.length === 0) {
    return message.reply(
      `❌ No shop items found.\n\n` +
        `Level: **${requestedLevel}**\n` +
        `Filter: **${getTypeLabel(typeFilter)}**\n` +
        `Class: **${player.class || "Unknown"}**`
    );
  }

  const itemsText = filteredItems
    .slice(0, 20)
    .map((item) => {
      const icon = item.emoji || "📦";
      const qualityEmoji = getQualityEmoji(item.quality || "Common");

      return (
        `${icon} **${item.name}**\n` +
        `🏷️ ID: \`${item.id}\`\n` +
        `${qualityEmoji} ${item.quality || "Common"} • ${item.type || "Unknown"}\n` +
        `🔓 Required: Lv.${item.requiredLevel || 1}\n` +
        `🎭 Class: \`${formatClass(item.compatibleClasses || ["all"])}\`\n` +
        `📊 ${formatStats(item.stats || {})}\n` +
        `💰 ${item.price || 0} Gold\n` +
        `✨ ${item.description || "No description"}`
      );
    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle(`🏪 SYXTH SHOP • LEVEL ${requestedLevel}`)
    .setDescription(
      `👤 Class: **${player.class || "Unknown"}**\n` +
        `📈 Your Level: **Lv.${player.level || 1}**\n` +
        `🪙 Your Gold: **${player.gold || 0}**\n` +
        `📂 Filter: **${getTypeLabel(typeFilter)}**\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `${itemsText}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🛒 Buy Item:\n` +
        `\`!s buy <item_id> <quantity>\`\n\n` +
        `📖 Examples:\n` +
        `\`!s shop 5 weapon\`\n` +
        `\`!s shop 10 equipment\`\n` +
        `\`!s buy archer_iron_weapon 1\`\n\n` +
        `🗂️ Available Shop Levels:\n` +
        `\`${SHOP_LEVELS.join(" ")}\``
    )
    .setFooter({
      text: "Syxth MMORPG Shop",
    });

  return message.reply({
    embeds: [embed],
  });
};