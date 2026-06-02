const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");

const ITEMS_PER_PAGE = 8;

function getDefaultStats() {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
    dodge: 0,
    crit: 0,
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

function getPriceMultiplierBySource(item = {}, quality = "Common") {
  const source = getSource(item);

  if (source === "boss_raid") {
    return Number(balanceConfig.bossDrop?.priceMultiplier?.[quality] || 1);
  }

  if (source === "monster_drop") {
    return Number(balanceConfig.monsterDrop?.priceMultiplier?.[quality] || 1);
  }

  if (source === "admin_generated" || source === "admin") {
    return Number(
      balanceConfig.adminItem?.priceMultiplier?.[quality] ||
        balanceConfig.quality?.[quality]?.priceMultiplier ||
        1
    );
  }

  return Number(balanceConfig.quality?.[quality]?.priceMultiplier || 1);
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

function getCleanItemName(baseName = "Unknown Item", quality = "Common") {
  const cleanBaseName = String(baseName || "Unknown Item").replace(
    /^(Common|Rare|Legendary|Starter)\s+/i,
    ""
  );

  if (quality === "Starter") {
    return cleanBaseName;
  }

  return `${quality} ${cleanBaseName}`;
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
      quantity: Math.max(1, Number(item.quantity || 1)),
      stats: getDefaultStats(),
      description: item.description || "Starter weapon.",
    };
  }

  if (isConsumable(item)) {
    return {
      ...item,
      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),
      quantity: Math.max(1, Number(item.quantity || 1)),
      stats: item.stats || getDefaultStats(),
      healPercent: Number(item.healPercent || 0),
      healAmount: Number(item.healAmount || item.heal || 0),
    };
  }

  const baseItem = findBaseShopItem(item);

  if (!baseItem) {
    const fallbackStats = normalizeFallbackStats(item);

    return {
      ...item,
      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),
      quantity: Math.max(1, Number(item.quantity || 1)),
      stats: fallbackStats,
      description: makeDescription(fallbackStats),
    };
  }

  const multiplier = getDeterministicMultiplier(item, quality);

  const rebalancedStats = scaleStats(
    baseItem.stats || getDefaultStats(),
    multiplier,
    quality,
    source
  );

  const priceMultiplier = getPriceMultiplierBySource(item, quality);

  return {
    ...item,
    id: item.id || baseItem.id,
    baseItemId: baseItem.id,
    name:
      source === "shop"
        ? baseItem.name
        : getCleanItemName(baseItem.name, quality),
    type: baseItem.type || item.type || "Unknown",
    quality,
    qualityEmoji: getQualityEmoji(quality),
    requiredLevel: Number(baseItem.requiredLevel || item.requiredLevel || 1),
    compatibleClasses:
      baseItem.compatibleClasses || item.compatibleClasses || ["all"],
    price: Math.floor(
      Number(baseItem.price || item.price || 0) * priceMultiplier
    ),
    description: makeDescription(rebalancedStats),
    stats: rebalancedStats,
    emoji: baseItem.emoji || item.emoji || "📦",
    quantity: Math.max(1, Number(item.quantity || 1)),
    source,
  };
}

function normalizeInventory(inventory = []) {
  if (!Array.isArray(inventory)) return [];

  return inventory
    .filter(Boolean)
    .map((item) => rebalanceItemStats(item))
    .filter(Boolean);
}

function getItemEmoji(item = {}) {
  if (item.emoji) return item.emoji;

  const type = String(item.type || "").toLowerCase();

  if (type === "weapon") return "🗡️";
  if (type === "helmet") return "⛑️";
  if (type === "armor") return "🥋";
  if (type === "gloves") return "🧤";
  if (type === "pants") return "👖";
  if (type === "boots") return "🥾";
  if (type === "consumable") return "🧪";

  return "📦";
}

function getQualityDisplay(item = {}) {
  const quality = item.quality || "Common";

  if (quality === "Starter") {
    return {
      quality,
      qualityEmoji: "🌱",
    };
  }

  return {
    quality,
    qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),
  };
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

function formatStats(stats = {}) {
  const result = [];

  if (stats.attack) result.push(`⚔️ +${stats.attack}`);
  if (stats.defense) result.push(`🛡️ +${stats.defense}`);
  if (stats.maxHp) result.push(`❤️ +${stats.maxHp}`);
  if (stats.dodge) result.push(`💨 +${stats.dodge}%`);
  if (stats.crit) result.push(`💥 +${stats.crit}%`);

  return result.length ? result.join(" • ") : "No stats";
}

function getTotalQuantity(items = []) {
  return items.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );
}

function filterInventory(inventory = [], filter = "all") {
  const normalized = String(filter || "all").toLowerCase();

  if (normalized === "all") return inventory;

  if (normalized === "equipment") {
    return inventory.filter(
      (item) => String(item.type || "").toLowerCase() !== "consumable"
    );
  }

  if (normalized === "consumable" || normalized === "consumables") {
    return inventory.filter(
      (item) => String(item.type || "").toLowerCase() === "consumable"
    );
  }

  if (["common", "rare", "legendary", "starter"].includes(normalized)) {
    return inventory.filter(
      (item) => String(item.quality || "Common").toLowerCase() === normalized
    );
  }

  return null;
}

function sortInventory(items = []) {
  const qualityOrder = {
    Legendary: 1,
    Rare: 2,
    Common: 3,
    Starter: 4,
  };

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
    const qualityA = qualityOrder[a.quality] || 99;
    const qualityB = qualityOrder[b.quality] || 99;

    if (qualityA !== qualityB) return qualityA - qualityB;

    const levelA = Number(a.requiredLevel || 1);
    const levelB = Number(b.requiredLevel || 1);

    if (levelA !== levelB) return levelB - levelA;

    const typeA = typeOrder[a.type] || 99;
    const typeB = typeOrder[b.type] || 99;

    if (typeA !== typeB) return typeA - typeB;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getFilterLabel(filter) {
  const normalized = String(filter || "all").toLowerCase();

  const labels = {
    all: "All Items",
    equipment: "Equipment",
    consumable: "Consumables",
    consumables: "Consumables",
    common: "Common Items",
    rare: "Rare Items",
    legendary: "Legendary Items",
    starter: "Starter Items",
  };

  return labels[normalized] || "All Items";
}

function getValidFiltersText() {
  return (
    "Use:\n" +
    "`!s inventory all`\n" +
    "`!s inventory equipment`\n" +
    "`!s inventory consumable`\n" +
    "`!s inventory common`\n" +
    "`!s inventory rare`\n" +
    "`!s inventory legendary`\n" +
    "`!s inventory starter`"
  );
}

module.exports = async function inventoryCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const filter = String(args[0] || "all").toLowerCase();

  const validFilters = [
    "all",
    "equipment",
    "consumable",
    "consumables",
    "common",
    "rare",
    "legendary",
    "starter",
  ];

  if (!validFilters.includes(filter)) {
    return message.reply(
      "❌ Invalid inventory filter.\n\n" + getValidFiltersText()
    );
  }

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();

  const rawInventory = Array.isArray(player.inventory)
    ? player.inventory
    : [];

  const rebalancedInventory = normalizeInventory(rawInventory);
  const filtered = filterInventory(rebalancedInventory, filter);

  if (!filtered) {
    return message.reply("❌ Invalid inventory filter.");
  }

  const inventory = sortInventory(filtered);

  let currentPage = 0;

  const totalPages = Math.max(
    1,
    Math.ceil(inventory.length / ITEMS_PER_PAGE)
  );

  const filterLabel = getFilterLabel(filter);
  const totalQuantity = getTotalQuantity(inventory);
  const allQuantity = getTotalQuantity(rebalancedInventory);

  function createEmbed(page) {
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentItems = inventory.slice(start, end);

    const itemsText =
      currentItems.length === 0
        ? "❌ No items found for this filter."
        : currentItems
            .map((item) => {
              const emoji = getItemEmoji(item);
              const { quality, qualityEmoji } = getQualityDisplay(item);
              const quantity = Number(item.quantity || 1);
              const baseItemId = item.baseItemId || item.id || "no-base-id";

              return (
                `${emoji} **${item.name || "Unknown Item"}** x${quantity}\n` +
                `└ ${qualityEmoji} ${quality} • ${item.type || "Unknown"}\n` +
                `└ 🔓 Lv.${item.requiredLevel || 1}\n` +
                `└ 🎭 ${formatClass(item.compatibleClasses || ["all"])}\n` +
                `└ 📊 ${formatStats(item.stats || {})}\n` +
                `└ 💰 Price: ${item.price || 0} Gold\n` +
                `└ 🏷️ ID: \`${item.id || "no-id"}\`\n` +
                `└ 🧬 Base ID: \`${baseItemId}\``
              );
            })
            .join("\n\n");

    return new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle(`🎒 SYXTH INVENTORY • ${filterLabel}`)
      .setDescription(
        `👤 **${player.username || message.author.username}**\n` +
          `🎭 Class: **${player.class || "Unknown"}**\n` +
          `🪙 Gold: **${player.gold || 0}**\n` +
          `📦 Showing: **${inventory.length} stacks / ${totalQuantity} total items**\n` +
          `🎒 Full Inventory: **${rebalancedInventory.length} stacks / ${allQuantity} total items**\n\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          itemsText
      )
      .setThumbnail(
        message.author.displayAvatarURL({
          dynamic: true,
        })
      )
      .setFooter({
        text: `Page ${page + 1}/${totalPages} • Filter: ${filterLabel}`,
      });
  }

  function createButtons(page) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`inventory_prev_${userId}`)
        .setLabel("Previous")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId(`inventory_next_${userId}`)
        .setLabel("Next")
        .setEmoji("➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages - 1)
    );
  }

  const reply = await message.reply({
    embeds: [createEmbed(currentPage)],
    components: totalPages > 1 ? [createButtons(currentPage)] : [],
  });

  if (totalPages <= 1) return null;

  const collector = reply.createMessageComponentCollector({
    time: 120000,
    filter: (interaction) =>
      interaction.user.id === userId &&
      [
        `inventory_prev_${userId}`,
        `inventory_next_${userId}`,
      ].includes(interaction.customId),
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === `inventory_prev_${userId}`) {
      currentPage = Math.max(0, currentPage - 1);
    }

    if (interaction.customId === `inventory_next_${userId}`) {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
    }

    await interaction
      .update({
        embeds: [createEmbed(currentPage)],
        components: [createButtons(currentPage)],
      })
      .catch(() => null);
  });

  collector.on("end", async () => {
    await reply
      .edit({
        components: [],
      })
      .catch(() => null);
  });

  return null;
};