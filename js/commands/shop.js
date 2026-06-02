const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");

const ITEM_LEVELS =
  balanceConfig.item?.levels ||
  balanceConfig.ITEM_LEVELS ||
  [];

const SHOP_LEVELS = [
  1,
  ...ITEM_LEVELS.map(([level]) => Number(level || 1)),
]
  .filter((level, index, array) => array.indexOf(level) === index)
  .sort((a, b) => a - b);

const MAX_ITEMS_DISPLAYED = 20;

function canUseItem(player, item) {
  const compatibleClasses = Array.isArray(item.compatibleClasses)
    ? item.compatibleClasses
    : ["all"];

  if (compatibleClasses.includes("all")) return true;

  return compatibleClasses.includes(player.classId);
}

function getNearestShopLevel(playerLevel) {
  const level = Number(playerLevel || 1);

  let nearest = SHOP_LEVELS[0] || 1;

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

function capShopPercentStat(statName, value) {
  const statValue = Number(value || 0);

  if (typeof balanceConfig.capItemPercentStat === "function") {
    return balanceConfig.capItemPercentStat(
      statName,
      statValue,
      "Common",
      "shop"
    );
  }

  const cap = Number(balanceConfig.item?.statCaps?.[statName] || 0);

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function normalizeShopStats(stats = {}) {
  return {
    attack: Math.floor(Number(stats.attack || 0)),
    defense: Math.floor(Number(stats.defense || 0)),
    maxHp: Math.floor(Number(stats.maxHp || 0)),
    dodge: capShopPercentStat(
      "dodge",
      Number(Number(stats.dodge || 0).toFixed(1))
    ),
    crit: capShopPercentStat(
      "crit",
      Number(Number(stats.crit || 0).toFixed(1))
    ),
  };
}

function makeDescription(stats = {}) {
  const parts = [];

  if (stats.attack) parts.push(`+${stats.attack} ATK`);
  if (stats.defense) parts.push(`+${stats.defense} DEF`);
  if (stats.maxHp) parts.push(`+${stats.maxHp} HP`);
  if (stats.dodge) parts.push(`+${stats.dodge}% Dodge`);
  if (stats.crit) parts.push(`+${stats.crit}% Crit`);

  return parts.length ? parts.join(", ") : "No bonus stats";
}

function normalizeShopItem(item = {}) {
  const quality = item.quality || "Common";
  const stats = normalizeShopStats(item.stats || {});

  return {
    ...item,

    baseItemId: item.baseItemId || item.id,

    quality,
    qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),

    requiredLevel: Number(item.requiredLevel || 1),
    compatibleClasses: item.compatibleClasses || ["all"],

    price: Math.max(0, Math.floor(Number(item.price || 0))),

    stats,
    description: item.description || makeDescription(stats),

    source: item.source || "shop",
    emoji: item.emoji || "📦",
  };
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

    const levelA = Number(a.requiredLevel || 1);
    const levelB = Number(b.requiredLevel || 1);

    if (levelA !== levelB) return levelA - levelB;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getAvailableLevelsText() {
  return SHOP_LEVELS.length ? SHOP_LEVELS.join(" ") : "1";
}

function getShopUsageText() {
  return (
    "Examples:\n" +
    "`!s shop`\n" +
    "`!s shop 5`\n" +
    "`!s shop 5 weapon`\n" +
    "`!s shop 10 equipment`\n" +
    "`!s shop consumable`\n\n" +
    "Filters:\n" +
    "`all`, `equipment`, `weapon`, `helmet`, `armor`, `gloves`, `pants`, `boots`, `consumable`"
  );
}

function parseShopRequest(args = [], playerLevel = 1) {
  const firstArg = String(args[0] || "").toLowerCase();
  const secondArg = String(args[1] || "").toLowerCase();

  let requestedLevel = null;
  let typeFilter = "all";

  if (!firstArg) {
    requestedLevel = getNearestShopLevel(playerLevel);
    return {
      ok: true,
      requestedLevel,
      typeFilter,
    };
  }

  if (!Number.isNaN(Number(firstArg))) {
    requestedLevel = Number(firstArg);
    typeFilter = normalizeTypeFilter(secondArg || "all");

    if (!typeFilter) {
      return {
        ok: false,
        message:
          "❌ Invalid shop filter.\n\n" +
          "Use: `all`, `equipment`, `weapon`, `helmet`, `armor`, `gloves`, `pants`, `boots`, `consumable`",
      };
    }

    return {
      ok: true,
      requestedLevel,
      typeFilter,
    };
  }

  requestedLevel = getNearestShopLevel(playerLevel);
  typeFilter = normalizeTypeFilter(firstArg);

  if (!typeFilter) {
    return {
      ok: false,
      message:
        "❌ Invalid shop command.\n\n" +
        getShopUsageText(),
    };
  }

  return {
    ok: true,
    requestedLevel,
    typeFilter,
  };
}

module.exports = async function shopCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();
  const playerLevel = Number(player.level || 1);

  const request = parseShopRequest(args, playerLevel);

  if (!request.ok) {
    return message.reply(request.message || "❌ Invalid shop command.");
  }

  const { requestedLevel, typeFilter } = request;

  if (!SHOP_LEVELS.includes(requestedLevel)) {
    return message.reply(
      `❌ Invalid shop level: **${requestedLevel}**\n\n` +
        `Available levels:\n` +
        `\`${getAvailableLevelsText()}\``
    );
  }

  const filteredItems = sortShopItems(
    shopItems
      .map((item) => normalizeShopItem(item))
      .filter(
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

  const displayedItems = filteredItems.slice(0, MAX_ITEMS_DISPLAYED);
  const hiddenCount = Math.max(0, filteredItems.length - displayedItems.length);

  const itemsText = displayedItems
  .map((item) => {
    const icon = item.emoji || "📦";
    const qualityEmoji =
      item.qualityEmoji || getQualityEmoji(item.quality || "Common");

    return (
      `${icon} **${item.name || "Unknown Item"}**\n` +
      `🏷️ ID: \`${item.id || "no-id"}\`\n` +
      `${qualityEmoji} ${item.quality || "Common"} • ${item.type || "Unknown"}\n` +
      `🔓 Required: Lv.${item.requiredLevel || 1}\n` +
      `🎭 Class: \`${formatClass(item.compatibleClasses || ["all"])}\`\n` +
      `📊 ${formatStats(item.stats || {})}\n` +
      `💰 ${item.price || 0} Gold`
    );
  })
  .join("\n\n");

  const hiddenText =
    hiddenCount > 0
      ? `\n\nℹ️ Showing first **${MAX_ITEMS_DISPLAYED}** items only. Hidden: **${hiddenCount}**. Use a narrower filter.`
      : "";

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle(`🏪 SYXTH SHOP • LEVEL ${requestedLevel}`)
    .setDescription(
      `👤 Class: **${player.class || "Unknown"}**\n` +
        `📈 Your Level: **Lv.${playerLevel}**\n` +
        `🪙 Your Gold: **${player.gold || 0}**\n` +
        `📂 Filter: **${getTypeLabel(typeFilter)}**\n` +
        `📦 Items Found: **${filteredItems.length}**\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `${itemsText}` +
        `${hiddenText}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🛒 Buy Item:\n` +
        `\`!s buy <item_id> <quantity>\`\n\n` +
        `📖 Examples:\n` +
        `\`!s shop 5 weapon\`\n` +
        `\`!s shop 10 equipment\`\n` +
        `\`!s buy archer_iron_weapon 1\`\n\n` +
        `🗂️ Available Shop Levels:\n` +
        `\`${getAvailableLevelsText()}\``
    )
    .setFooter({
      text: "Syxth MMORPG Shop",
    });

  return message.reply({
    embeds: [embed],
  });
};