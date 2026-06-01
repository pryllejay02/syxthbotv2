const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");

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
  const basePrice = Number(item.price || 0);

  if (basePrice <= 0) return 0;

  const multiplier = getSellMultiplier(item.quality || "Common");

  return Math.floor(basePrice * multiplier);
}

function canSellItem(item) {
  if (!item) return false;
  if (item.quality === "Starter") return false;
  if (item.isStarter) return false;

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
    const inventory = Array.isArray(player.inventory)
      ? [...player.inventory]
      : [];

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

    const itemIndex = inventory.findIndex(
      (item) =>
        item.id &&
        String(item.id).toLowerCase() === itemId
    );

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

  const qualityEmoji = getQualityEmoji(result.item.quality || "Common");

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