const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");

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
      price: Number(sourceItem.price || item.price || 0),
      description: sourceItem.description || item.description || "Consumable item.",
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

function normalizeInventory(inventory = []) {
  if (!Array.isArray(inventory)) return [];

  return inventory
    .filter(Boolean)
    .map((item) => rebalanceItemStats(item))
    .filter(Boolean);
}

function getSellMultiplier(quality = "Common") {
  if (typeof balanceConfig.getSellMultiplier === "function") {
    return balanceConfig.getSellMultiplier(quality);
  }

  return (
    balanceConfig.economy?.sellMultiplier?.[quality] ??
    balanceConfig.economy?.sellMultiplier?.default ??
    0.5
  );
}

function getSellPrice(item = {}) {
  const rebalancedItem = rebalanceItemStats(item);

  if (!rebalancedItem) return 0;

  const basePrice = Number(rebalancedItem.price || 0);

  if (basePrice <= 0) return 0;

  const multiplier = getSellMultiplier(rebalancedItem.quality || "Common");

  return Math.floor(basePrice * multiplier);
}

function canSellItem(item) {
  if (!item) return false;
  if (isStarterItem(item)) return false;

  return getSellPrice(item) > 0;
}

function getItemQuantity(item) {
  return Math.max(1, Number(item.quantity || 1));
}

function parseSellQuantity(value, ownedQuantity) {
  if (String(value || "").toLowerCase() === "all") {
    return ownedQuantity;
  }

  const quantity = Number(value || 1);

  if (!Number.isInteger(quantity)) return null;
  if (quantity <= 0) return null;
  if (quantity > ownedQuantity) return null;

  return quantity;
}

function getQualityFilter(value) {
  const filter = String(value || "").toLowerCase();

  if (!filter) return null;
  if (filter === "common") return "Common";
  if (filter === "rare") return "Rare";
  if (filter === "legendary") return "Legendary";

  return "invalid";
}

function getBulkSellSummary() {
  return {
    totalGold: 0,
    totalItemsSold: 0,
    commonSold: 0,
    rareSold: 0,
    legendarySold: 0,
  };
}

function addToBulkSummary(summary, item, quantity, earnedGold) {
  const quality = item.quality || "Common";

  summary.totalGold += earnedGold;
  summary.totalItemsSold += quantity;

  if (quality === "Rare") {
    summary.rareSold += quantity;
  } else if (quality === "Legendary") {
    summary.legendarySold += quantity;
  } else {
    summary.commonSold += quantity;
  }

  return summary;
}

function findInventoryItemIndex(inventory = [], itemId) {
  const targetId = normalizeId(itemId);

  return inventory.findIndex((item) => {
    if (!item) return false;

    const id = normalizeId(item.id);
    const baseItemId = normalizeId(item.baseItemId);

    return id === targetId || baseItemId === targetId;
  });
}

module.exports = async function sellCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const action = String(args[0] || "").toLowerCase();
  const secondArg = String(args[1] || "").toLowerCase();

  if (!action) {
    return message.reply(
      "❌ Please specify what to sell.\n\n" +
        "Examples:\n" +
        "`!s sell archer_iron_weapon 1`\n" +
        "`!s sell archer_iron_weapon all`\n" +
        "`!s sell all`\n" +
        "`!s sell all common`\n" +
        "`!s sell all rare`\n" +
        "`!s sell all legendary`"
    );
  }

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "You don’t have a character yet. Use `!s start` first.",
      };
    }

    const player = playerDoc.data();
    const inventory = normalizeInventory(player.inventory || []);

    if (inventory.length === 0) {
      return {
        ok: false,
        message: "❌ Your inventory is empty.",
      };
    }

    if (action === "all") {
      const qualityFilter = getQualityFilter(secondArg);

      if (qualityFilter === "invalid") {
        return {
          ok: false,
          message:
            "❌ Invalid sell filter.\n\nUse:\n" +
            "`!s sell all`\n" +
            "`!s sell all common`\n" +
            "`!s sell all rare`\n" +
            "`!s sell all legendary`",
        };
      }

      const summary = getBulkSellSummary();
      const remainingInventory = [];

      inventory.forEach((item) => {
        const itemQuality = item.quality || "Common";
        const matchesFilter = !qualityFilter || itemQuality === qualityFilter;

        if (!matchesFilter || !canSellItem(item)) {
          remainingInventory.push(item);
          return;
        }

        const quantity = getItemQuantity(item);
        const sellPrice = getSellPrice(item);
        const earnedGold = sellPrice * quantity;

        addToBulkSummary(summary, item, quantity, earnedGold);
      });

      if (summary.totalItemsSold <= 0) {
        return {
          ok: false,
          message: "❌ No sellable items found.",
        };
      }

      const oldGold = Number(player.gold || 0);
      const newGold = oldGold + summary.totalGold;

      transaction.update(playerRef, {
        gold: newGold,
        inventory: remainingInventory,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        bulk: true,
        oldGold,
        newGold,
        ...summary,
      };
    }

    const itemId = action;
    const quantityArg = secondArg || "1";

    const itemIndex = findInventoryItemIndex(inventory, itemId);

    if (itemIndex === -1) {
      return {
        ok: false,
        message: "❌ You don’t have that item in your inventory.",
      };
    }

    const item = inventory[itemIndex];

    if (!canSellItem(item)) {
      return {
        ok: false,
        message:
          "❌ This item cannot be sold.\n\n" +
          "Starter items and items with no sell value cannot be sold.",
      };
    }

    const ownedQuantity = getItemQuantity(item);
    const quantity = parseSellQuantity(quantityArg, ownedQuantity);

    if (!quantity) {
      return {
        ok: false,
        message:
          `❌ Invalid quantity.\n\n` +
          `You have **${ownedQuantity}x** of this item.\n` +
          `Use a number from **1-${ownedQuantity}** or use \`all\`.`,
      };
    }

    const sellPrice = getSellPrice(item);
    const totalGold = sellPrice * quantity;
    const oldGold = Number(player.gold || 0);
    const newGold = oldGold + totalGold;
    const remainingQuantity = ownedQuantity - quantity;

    if (remainingQuantity > 0) {
      inventory[itemIndex] = {
        ...item,
        quantity: remainingQuantity,
      };
    } else {
      inventory.splice(itemIndex, 1);
    }

    transaction.update(playerRef, {
      gold: newGold,
      inventory,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      bulk: false,
      item,
      quantity,
      sellPrice,
      totalGold,
      oldGold,
      newGold,
      remainingQuantity,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Sell failed.");
  }

  if (result.bulk) {
    return message.reply(
      `💰 **Bulk Sell Complete!**\n\n` +
        `📦 Items Sold: **${result.totalItemsSold}**\n` +
        `🟢 Common Sold: **${result.commonSold}**\n` +
        `🔵 Rare Sold: **${result.rareSold}**\n` +
        `🟠 Legendary Sold: **${result.legendarySold}**\n\n` +
        `💰 Gold Earned: **${result.totalGold}**\n` +
        `🪙 Old Gold: **${result.oldGold}**\n` +
        `🪙 New Gold Balance: **${result.newGold}**`
    );
  }

  const qualityEmoji =
    result.item.quality === "Starter"
      ? "🌱"
      : result.item.qualityEmoji || getQualityEmoji(result.item.quality || "Common");

  return message.reply(
    `${result.item.emoji || "📦"} Sold **${result.item.name} x${result.quantity}**!\n\n` +
      `Quality: **${qualityEmoji} ${result.item.quality || "Common"}**\n` +
      `💰 Sell Price Each: **${result.sellPrice} Gold**\n` +
      `💰 Gold Earned: **${result.totalGold} Gold**\n` +
      `🪙 Old Gold: **${result.oldGold}**\n` +
      `🪙 New Gold Balance: **${result.newGold}**\n` +
      `📦 Remaining Quantity: **${Math.max(0, result.remainingQuantity)}**`
  );
};