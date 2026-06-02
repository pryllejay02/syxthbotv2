const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");
const bossConfig = require("../data/bossConfig");
const balanceConfig = require("../data/balanceConfig");
const { getQualityEmoji } = require("../utils/qualitySystem");
const { generateBossDrop } = require("../utils/bossLootSystem");

const MAX_ADMIN_ITEM_QUANTITY = Number(
  balanceConfig.adminItem?.maxQuantity || 50
);

const DEFAULT_ADMIN_PERCENT_CAPS = {
  Common: {
    dodge: 4,
    crit: 5,
  },

  Rare: {
    dodge: 6,
    crit: 8,
  },

  Legendary: {
    dodge: 9,
    crit: 12,
  },
};

function getMention(message) {
  return message.mentions.users.first();
}

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
}

function randomBetween(min, max) {
  if (typeof balanceConfig.randomBetween === "function") {
    return balanceConfig.randomBetween(min, max);
  }

  const safeMin = Number(min || 1);
  const safeMax = Number(max || safeMin);

  if (safeMax <= safeMin) return safeMin;

  return Math.random() * (safeMax - safeMin) + safeMin;
}

function normalizeQuality(input, allowedQualities) {
  return allowedQualities.find(
    (quality) =>
      quality.toLowerCase() === String(input || "").toLowerCase()
  );
}

function parseQuantity(value) {
  const quantity = Number(value || 1);

  if (!Number.isInteger(quantity)) return null;
  if (quantity <= 0) return null;
  if (quantity > MAX_ADMIN_ITEM_QUANTITY) return null;

  return quantity;
}

function isConsumable(item = {}) {
  return String(item.type || "").toLowerCase() === "consumable";
}

function getDefaultStats() {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
    dodge: 0,
    crit: 0,
  };
}

function getRollConfigByQuality(quality = "Common") {
  return (
    balanceConfig.adminItem?.statRolls?.[quality] ||
    balanceConfig.adminItem?.statRolls?.Common ||
    {
      min: 1,
      max: 1.1,
    }
  );
}

function getConfiguredPercentCap(statName, quality = "Common") {
  const adminCap = Number(
    balanceConfig.adminItem?.statCaps?.[quality]?.[statName] || 0
  );

  if (adminCap > 0) return adminCap;

  if (quality === "Common") {
    const shopCap = Number(balanceConfig.item?.statCaps?.[statName] || 0);

    if (shopCap > 0) return shopCap;
  }

  if (quality === "Rare") {
    const rareDropCap = Number(
      balanceConfig.monsterDrop?.statCaps?.Rare?.[statName] || 0
    );

    if (rareDropCap > 0) return rareDropCap;
  }

  if (quality === "Legendary") {
    const legendaryDropCap = Number(
      balanceConfig.bossDrop?.statCaps?.Legendary?.[statName] || 0
    );

    if (legendaryDropCap > 0) return legendaryDropCap;
  }

  return Number(DEFAULT_ADMIN_PERCENT_CAPS[quality]?.[statName] || 0);
}

function capPercentStat(statName, value, quality = "Common") {
  const statValue = Number(value || 0);
  const cap = getConfiguredPercentCap(statName, quality);

  if (cap > 0) {
    return Math.min(statValue, cap);
  }

  if (typeof balanceConfig.capItemPercentStat === "function") {
    return balanceConfig.capItemPercentStat(
      statName,
      statValue,
      quality,
      "admin_generated"
    );
  }

  return statValue;
}

function scaleStatsByQuality(stats = {}, quality = "Common") {
  const rollConfig = getRollConfigByQuality(quality);

  const multiplier = randomBetween(
    Number(rollConfig.min || 1),
    Number(rollConfig.max || 1)
  );

  const attack = Math.floor(Number(stats.attack || 0) * multiplier);
  const defense = Math.floor(Number(stats.defense || 0) * multiplier);
  const maxHp = Math.floor(Number(stats.maxHp || 0) * multiplier);

  const dodge = capPercentStat(
    "dodge",
    Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
    quality
  );

  const crit = capPercentStat(
    "crit",
    Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
    quality
  );

  return {
    attack,
    defense,
    maxHp,
    dodge,
    crit,
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

function getQualityPriceMultiplier(quality = "Common") {
  if (quality === "Rare") {
    return Number(
      balanceConfig.adminItem?.priceMultiplier?.Rare ||
        balanceConfig.quality?.Rare?.priceMultiplier ||
        2
    );
  }

  if (quality === "Legendary") {
    return Number(
      balanceConfig.adminItem?.priceMultiplier?.Legendary ||
        balanceConfig.quality?.Legendary?.priceMultiplier ||
        5
    );
  }

  return Number(
    balanceConfig.adminItem?.priceMultiplier?.Common ||
      balanceConfig.quality?.Common?.priceMultiplier ||
      1
  );
}

function cleanItemName(name = "Unknown Item", quality = "Common") {
  const cleanBaseName = String(name || "Unknown Item").replace(
    /^(Common|Rare|Legendary|Starter)\s+/i,
    ""
  );

  return `${quality} ${cleanBaseName}`;
}

function findShopItemById(itemId) {
  const targetId = normalizeId(itemId);

  return shopItems.find(
    (shopItem) => shopItem.id && normalizeId(shopItem.id) === targetId
  );
}

function generateAdminItem(baseItem, quality) {
  const consumable = isConsumable(baseItem);

  const stats = consumable
    ? baseItem.stats || getDefaultStats()
    : scaleStatsByQuality(baseItem.stats || getDefaultStats(), quality);

  const qualityEmoji = getQualityEmoji(quality);

  return {
    ...baseItem,

    id: consumable
      ? baseItem.id
      : `${baseItem.id}_${quality.toLowerCase()}_admin_${Date.now()}_${Math.floor(
          Math.random() * 99999
        )}`,

    baseItemId: baseItem.baseItemId || baseItem.id,

    name: consumable
      ? baseItem.name
      : cleanItemName(baseItem.name, quality),

    quality,
    qualityEmoji,

    requiredLevel: Number(baseItem.requiredLevel || 1),
    compatibleClasses: baseItem.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || 0) * getQualityPriceMultiplier(quality)
    ),

    description: consumable
      ? baseItem.description || "Consumable item."
      : makeDescription(stats),

    stats,

    healPercent: Number(baseItem.healPercent || 0),
    healAmount: Number(baseItem.healAmount || baseItem.heal || 0),

    quantity: 1,
    source: consumable ? "admin_consumable" : "admin_generated",
    emoji: baseItem.emoji || "📦",
  };
}

function addItemToInventory(inventory = [], item, quantity = 1) {
  const consumable = isConsumable(item);

  const existingIndex = inventory.findIndex((invItem) => {
    if (consumable) {
      return normalizeId(invItem.id) === normalizeId(item.id);
    }

    return (
      invItem.baseItemId === item.baseItemId &&
      invItem.quality === item.quality &&
      JSON.stringify(invItem.stats || {}) === JSON.stringify(item.stats || {})
    );
  });

  if (existingIndex !== -1) {
    inventory[existingIndex].quantity =
      Number(inventory[existingIndex].quantity || 1) + quantity;
  } else {
    inventory.push({
      ...item,
      quantity,
    });
  }

  return inventory;
}

function getBossLevelByIdOrTier(value) {
  const key = String(value || "").toLowerCase();

  if (bossConfig.bosses?.[key]) {
    return bossConfig.bosses[key][0]?.level || 10;
  }

  for (const bosses of Object.values(bossConfig.bosses || {})) {
    const found = bosses.find(
      (boss) => boss.id && boss.id.toLowerCase() === key
    );

    if (found) return found.level;
  }

  return null;
}

function formatItemStats(item) {
  return (
    `⚔️ ${item.stats?.attack || 0} | ` +
    `🛡️ ${item.stats?.defense || 0} | ` +
    `❤️ ${item.stats?.maxHp || 0} | ` +
    `💨 ${item.stats?.dodge || 0}% | ` +
    `💥 ${item.stats?.crit || 0}%`
  );
}

module.exports = async function adminItems(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (!target || target.bot) {
    return message.reply("❌ Please mention a valid player.");
  }

  const playerRef = db.collection("players").doc(target.id);

  if (subCommand === "giveitem") {
    const itemId = args[2];
    const qualityInput = args[3] || "Common";
    const quantity = parseQuantity(args[4] || 1);

    if (!itemId || !quantity) {
      return message.reply(
        "❌ Usage: `!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>`\n" +
          `Quantity must be from **1-${MAX_ADMIN_ITEM_QUANTITY}**.`
      );
    }

    const validQuality = normalizeQuality(qualityInput, [
      "Common",
      "Rare",
      "Legendary",
    ]);

    if (!validQuality) {
      return message.reply(
        "❌ Quality must be `Common`, `Rare`, or `Legendary`."
      );
    }

    const baseItem = findShopItemById(itemId);

    if (!baseItem) {
      return message.reply("❌ Item not found in shopItems.");
    }

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const inventory = [...(player.inventory || [])];
      const givenItems = [];

      for (let i = 0; i < quantity; i++) {
        const item = generateAdminItem(baseItem, validQuality);

        addItemToInventory(inventory, item, 1);
        givenItems.push(item);
      }

      transaction.update(playerRef, {
        inventory,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        player,
        givenItems,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Give item failed.");
    }

    const exampleItem = result.givenItems[0];
    const cleanBaseName = String(baseItem.name || "Unknown Item").replace(
      /^(Common|Rare|Legendary|Starter)\s+/i,
      ""
    );

    return message.reply(
      `✅ Gave **${quantity}x ${validQuality} ${cleanBaseName}** to **${
        result.player.username || target.username
      }**.\n\n` +
        `🎁 Example Item: **${exampleItem.qualityEmoji} ${exampleItem.name}**\n` +
        `🏷️ ID: \`${exampleItem.id}\`\n` +
        `🔓 Level: **Lv.${exampleItem.requiredLevel || 1}**\n` +
        `🎭 Class: **${(exampleItem.compatibleClasses || ["all"]).join(", ")}**\n` +
        `📊 Stats: ${formatItemStats(exampleItem)}`
    );
  }

  if (subCommand === "givebossitem") {
    const bossOrTier = args[2];
    const qualityInput = args[3];
    const quantity = parseQuantity(args[4] || 1);

    if (!bossOrTier || !qualityInput || !quantity) {
      return message.reply(
        "❌ Usage: `!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>`\n" +
          `Quantity must be from **1-${MAX_ADMIN_ITEM_QUANTITY}**.`
      );
    }

    const validQuality = normalizeQuality(qualityInput, [
      "Rare",
      "Legendary",
    ]);

    if (!validQuality) {
      return message.reply("❌ Quality must be `Rare` or `Legendary`.");
    }

    const bossLevel = getBossLevelByIdOrTier(bossOrTier);

    if (!bossLevel) {
      return message.reply("❌ Boss ID or tier not found.");
    }

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const inventory = [...(player.inventory || [])];
      const givenItems = [];

      for (let i = 0; i < quantity; i++) {
        const item = generateBossDrop(bossLevel, validQuality);

        if (!item) {
          return {
            ok: false,
            message:
              "❌ Failed to generate boss item. Check shop item levels.",
          };
        }

        addItemToInventory(inventory, item, 1);
        givenItems.push(item);
      }

      transaction.update(playerRef, {
        inventory,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        player,
        givenItems,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Give boss item failed.");
    }

    const exampleItem = result.givenItems[0];

    return message.reply(
      `✅ Gave **${quantity}x ${validQuality} boss item(s)** to **${
        result.player.username || target.username
      }**.\n\n` +
        `🎁 Example Item: **${exampleItem.qualityEmoji} ${exampleItem.name}**\n` +
        `🏷️ ID: \`${exampleItem.id}\`\n` +
        `🔓 Level: **Lv.${exampleItem.requiredLevel || 1}**\n` +
        `🎭 Class: **${(exampleItem.compatibleClasses || ["all"]).join(", ")}**\n` +
        `📊 Stats: ${formatItemStats(exampleItem)}`
    );
  }

  return message.reply(
    "❌ Unknown item admin command.\n\n" +
      "Available:\n" +
      "`!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>`\n" +
      "`!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>`"
  );
};