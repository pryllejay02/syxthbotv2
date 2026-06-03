const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const tradeConfig = require("../data/tradeConfig");
const shopItems = require("../data/shopItems");
const balanceConfig = require("../data/balanceConfig");

const {
  getQualityEmoji,
  getQualityColor,
} = require("../utils/qualitySystem");

const {
  normalizePets,
  findPlayerPet,
  calculatePetStats,
  formatPetStats,
  formatPetStatus,
  getPetMaxLevel,
  getPetRequiredExp,
  getPetExpDisplay,
} = require("../utils/petSystem");

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

function normalizeInput(value) {
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
    .map(normalizeInput);

  for (const candidateId of candidateIds) {
    const exactMatch = shopItems.find(
      (shopItem) => normalizeInput(shopItem.id) === candidateId
    );

    if (exactMatch) return exactMatch;
  }

  const itemId = normalizeInput(item.id);

  if (!itemId) return null;

  const prefixMatches = shopItems
    .filter((shopItem) => itemId.startsWith(normalizeInput(shopItem.id)))
    .sort(
      (a, b) =>
        normalizeInput(b.id).length - normalizeInput(a.id).length
    );

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
  const baseItem = findBaseShopItem(item);

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
    const sourceItem = baseItem || item;

    return {
      ...item,

      id: item.id || sourceItem.id,
      baseItemId: sourceItem.baseItemId || sourceItem.id || item.baseItemId,

      name: sourceItem.name || item.name || "Unknown Consumable",
      type: sourceItem.type || item.type || "Consumable",

      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),

      requiredLevel: Number(sourceItem.requiredLevel || item.requiredLevel || 1),
      compatibleClasses:
        sourceItem.compatibleClasses || item.compatibleClasses || ["all"],

      price: Math.max(
        0,
        Math.floor(Number(sourceItem.price || item.price || 0))
      ),

      description:
        sourceItem.description || item.description || "Consumable item.",

      quantity: Math.max(1, Number(item.quantity || 1)),

      stats: getDefaultStats(),

      healPercent: Number(sourceItem.healPercent || item.healPercent || 0),
      healAmount: Number(
        sourceItem.healAmount ||
          sourceItem.heal ||
          item.healAmount ||
          item.heal ||
          0
      ),

      source: item.source || "shop",
      emoji: sourceItem.emoji || item.emoji || "🧪",
    };
  }

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
  const parts = [];

  if (stats.attack) parts.push(`⚔️ ATK: ${stats.attack}`);
  if (stats.defense) parts.push(`🛡️ DEF: ${stats.defense}`);
  if (stats.maxHp) parts.push(`❤️ HP: ${stats.maxHp}`);
  if (stats.dodge) parts.push(`💨 Dodge: ${stats.dodge}%`);
  if (stats.crit) parts.push(`💥 Crit: ${stats.crit}%`);

  return parts.length ? parts.join("\n") : "No bonus stats";
}

function getFallbackQualityColor(quality = "Common") {
  const normalizedQuality = String(quality || "Common").toLowerCase();

  if (normalizedQuality === "legendary") return "#F59E0B";
  if (normalizedQuality === "rare") return "#3B82F6";
  if (normalizedQuality === "common") return "#22C55E";
  if (normalizedQuality === "starter") return "#94A3B8";

  return "#8B0000";
}

function getSafeQualityColor(quality = "Common") {
  if (String(quality || "").toLowerCase() === "starter") {
    return getFallbackQualityColor("Starter");
  }

  if (typeof getQualityColor === "function") {
    try {
      return getQualityColor(quality);
    } catch {
      return getFallbackQualityColor(quality);
    }
  }

  return getFallbackQualityColor(quality);
}

function getItemColor(item = {}) {
  return getSafeQualityColor(item.quality || "Common");
}

function getItemEmoji(item = {}) {
  if (item.emoji) return item.emoji;

  const type = String(item.type || "").toLowerCase();

  if (type === "weapon") return "🗡️";
  if (type === "helmet") return "⛑️";
  if (type === "armor") return "🦺";
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

function findInventoryItem(inventory = [], itemId) {
  const normalizedItemId = normalizeInput(itemId);

  return inventory.find((item) => {
    if (!item) return false;

    const id = normalizeInput(item.id);
    const baseItemId = normalizeInput(item.baseItemId);

    return id === normalizedItemId || baseItemId === normalizedItemId;
  });
}

function findEquippedItem(equipment = {}, input) {
  const normalized = normalizeInput(input);

  if (EQUIPMENT_SLOTS.includes(normalized)) {
    const item = equipment[normalized];

    if (!item) return null;

    return {
      item,
      slot: normalized,
    };
  }

  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];

    if (!item) continue;

    const id = normalizeInput(item.id);
    const baseItemId = normalizeInput(item.baseItemId);

    if (id === normalized || baseItemId === normalized) {
      return {
        item,
        slot,
      };
    }
  }

  return null;
}

function getItemSourceText(source = "unknown") {
  const normalized = String(source || "unknown").toLowerCase();

  const labels = {
    shop: "Shop Item",
    starter: "Starter Item",
    monster_drop: "Monster Drop",
    boss_raid: "Boss Raid Drop",
    admin_generated: "Admin Generated Item",
    admin: "Admin Generated Item",
    admin_consumable: "Admin Given Consumable",
    unknown: "Unknown",
  };

  return labels[normalized] || source;
}

function formatSourceText(locationText, itemSource = null) {
  if (!itemSource) return String(locationText || "Unknown");

  return `${String(locationText || "Unknown")} • ${getItemSourceText(itemSource)}`;
}

function getPetColor(pet = {}) {
  return getSafeQualityColor(pet.quality || "Common");
}

function getPetQualityDisplay(pet = {}) {
  const quality = pet.quality || "Common";

  return {
    quality,
    qualityEmoji: pet.qualityEmoji || getQualityEmoji(quality),
  };
}

function getPetExpDisplaySafe(pet = {}) {
  if (typeof getPetExpDisplay === "function") {
    return getPetExpDisplay(pet);
  }

  const level = Math.max(1, Number(pet.level || 1));
  const maxLevel = getPetMaxLevel(pet);

  if (level >= maxLevel) {
    return "MAX";
  }

  const nextExp =
    typeof getPetRequiredExp === "function"
      ? getPetRequiredExp(level)
      : "?";

  return `${Math.max(0, Number(pet.exp || 0))}/${nextExp}`;
}

function getPetTradeNote(pet = {}, player = {}) {
  const active =
    normalizeInput(pet.id) === normalizeInput(player.activePetId) ||
    pet.active === true;

  if (active) {
    return "⚠️ This pet is currently active. Unequip it first before trading.";
  }

  if (pet.locked === true) {
    return "🔒 This pet is locked. Unlock it first before trading.";
  }

  return "✅ This pet can be added to trade if you still own it.";
}

function getPetSourceText(source = "unknown") {
  const normalized = String(source || "unknown").toLowerCase();

  const labels = {
    monster_pet_drop: "Monster Pet Drop",
    boss_pet_drop: "Boss Pet Drop",
    admin_pet: "Admin Given Pet",
    admin_pet_generated: "Admin Given Pet",
    admin_generated: "Admin Generated",
    unknown: "Unknown",
  };

  return labels[normalized] || source;
}

async function flexPet(message, player, petId) {
  if (!petId) {
    return message.reply(
      "❌ Usage: `!s flex pet <pet_id>`\n\n" +
        "Example:\n" +
        "`!s flex pet baby_wolf_common_pet_12345`"
    );
  }

  const pets = normalizePets(player.pets || []);
  const normalizedPlayer = {
    ...player,
    pets,
  };

  const pet = findPlayerPet(normalizedPlayer, petId);

  if (!pet) {
    return message.reply("❌ You don’t have that pet.");
  }

  const petStats = calculatePetStats(pet);
  const maxLevel = getPetMaxLevel(pet);
  const { quality, qualityEmoji } = getPetQualityDisplay(pet);

  const embed = new EmbedBuilder()
    .setColor(getPetColor(pet))
    .setTitle("🐾 SYXTH PET FLEX")
    .setDescription(
      `👤 **${player.username || message.author.username}** is showing a pet:\n\n` +
        `${pet.emoji || "🐾"} ${qualityEmoji} **${
          pet.name || "Unknown Pet"
        }**\n\n` +
        `━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: "🏷️ Pet Info",
        value:
          `**ID:** \`${pet.id || "no-id"}\`\n` +
          `**Base ID:** \`${pet.basePetId || pet.id || "no-base-id"}\`\n` +
          `**Type:** ${String(pet.type || "balanced").toUpperCase()}\n` +
          `**Quality:** ${qualityEmoji} ${quality}\n` +
          `**Source:** ${getPetSourceText(pet.source)}`,
        inline: true,
      },
      {
        name: "📈 Growth",
        value:
          `**Level:** Lv.${pet.level || 1}/${maxLevel}\n` +
          `**EXP:** ${getPetExpDisplaySafe(pet)}\n` +
          `**Required Level:** Lv.${pet.requiredLevel || 1}\n` +
          `**Status:** ${formatPetStatus(pet, player.activePetId)}`,
        inline: true,
      },
      {
        name: "📊 Passive Bonus",
        value: formatPetStats(petStats),
        inline: false,
      },
      {
        name: "🤝 Trade Note",
        value:
          `${getPetTradeNote(pet, player)}\n\n` +
          `To trade this pet, use \`!s trade addpet ${pet.id}\` inside the private trade room.`,
        inline: false,
      }
    )
    .setThumbnail(
      message.author.displayAvatarURL({
        dynamic: true,
      })
    )
    .setFooter({
      text: "Syxth MMORPG Trading Area",
    })
    .setTimestamp();

  return message.channel.send({
    embeds: [embed],
  });
}

module.exports = async function flexCommand(message, args = []) {
  const userId = message.author.id;
  const flexType = normalizeInput(args[0]);
  const itemId = args[0];

  if (message.channel.id !== tradeConfig.tradeAreaChannelId) {
    return message.reply(
      `❌ You can only flex items and pets inside <#${tradeConfig.tradeAreaChannelId}>.`
    );
  }

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID, equipped slot, or pet ID.\n\n" +
        "Examples:\n" +
        "`!s flex <item_id>`\n" +
        "`!s flex weapon`\n" +
        "`!s flex armor`\n" +
        "`!s flex pet <pet_id>`"
    );
  }

  const playerRef = db.collection("players").doc(userId);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "❌ You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();

  if (flexType === "pet") {
    return flexPet(message, player, args[1]);
  }

  const inventory = Array.isArray(player.inventory)
    ? player.inventory
    : [];

  const equipment = player.equipment || {};

  let item = findInventoryItem(inventory, itemId);
  let sourceText = "Inventory";
  let tradeWarning =
    "✅ This item can be added to trade if it is still in your inventory.";

  if (!item) {
    const equippedResult = findEquippedItem(equipment, itemId);

    if (equippedResult) {
      item = equippedResult.item;
      sourceText = `Equipped: ${equippedResult.slot}`;
      tradeWarning =
        "⚠️ This item is currently equipped. Unequip it first before trading.";
    }
  }

  if (!item) {
    return message.reply(
      "❌ You don’t have that item in your inventory or equipment."
    );
  }

  const rebalancedItem = rebalanceItemStats(item);

  if (!rebalancedItem) {
    return message.reply("❌ Failed to read this item.");
  }

  const { quality, qualityEmoji } = getQualityDisplay(rebalancedItem);
  const quantity = Number(rebalancedItem.quantity || 1);
  const itemEmoji = getItemEmoji(rebalancedItem);

  const embed = new EmbedBuilder()
    .setColor(getItemColor(rebalancedItem))
    .setTitle("💎 SYXTH ITEM FLEX")
    .setDescription(
      `👤 **${player.username || message.author.username}** is showing an item:\n\n` +
        `${itemEmoji} ${qualityEmoji} **${
          rebalancedItem.name || "Unknown Item"
        }**\n\n` +
        `━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: "🏷️ Item Info",
        value:
          `**ID:** \`${rebalancedItem.id || "no-id"}\`\n` +
          `**Base ID:** \`${
            rebalancedItem.baseItemId || rebalancedItem.id || "no-base-id"
          }\`\n` +
          `**Type:** ${rebalancedItem.type || "Unknown"}\n` +
          `**Quality:** ${qualityEmoji} ${quality}\n` +
          `**Quantity:** ${quantity}\n` +
          `**Source:** ${formatSourceText(sourceText, rebalancedItem.source)}`,
        inline: true,
      },
      {
        name: "🔓 Requirements",
        value:
          `**Required Level:** Lv.${rebalancedItem.requiredLevel || 1}\n` +
          `**Class:** ${formatClass(
            rebalancedItem.compatibleClasses || ["all"]
          )}\n` +
          `**Price Value:** ${rebalancedItem.price || 0} Gold`,
        inline: true,
      },
      {
        name: "📊 Bonus Stats",
        value: formatStats(rebalancedItem.stats || {}),
        inline: false,
      },
      {
        name: "🤝 Trade Note",
        value:
          `${tradeWarning}\n\n` +
          `To start a secure trade, use the private trade creation channel.`,
        inline: false,
      }
    )
    .setThumbnail(
      message.author.displayAvatarURL({
        dynamic: true,
      })
    )
    .setFooter({
      text: "Syxth MMORPG Trading Area",
    })
    .setTimestamp();

  return message.channel.send({
    embeds: [embed],
  });
};