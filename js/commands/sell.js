const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");

function getSellPrice(item) {
  const basePrice = Number(item.price || 0);
  if (basePrice <= 0) return 0;
  if (item.quality === "Rare") return Math.floor(basePrice * 0.75);
  if (item.quality === "Legendary") return Math.floor(basePrice * 0.85);
  return Math.floor(basePrice * 0.5);
}

function canSellItem(item) {
  if (!item) return false;
  if (item.quality === "Starter") return false;
  return getSellPrice(item) > 0;
}

function sellableQuantity(item) {
  return Number(item.quantity || 1);
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
        "`!s sell all rare`"
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
    const inventory = [...(player.inventory || [])];

    if (inventory.length === 0) {
      return {
        ok: false,
        message: "❌ Your inventory is empty.",
      };
    }

    if (action === "all") {
      const qualityFilter =
        secondArg === "common"
          ? "Common"
          : secondArg === "rare"
          ? "Rare"
          : secondArg === "legendary"
          ? "Legendary"
          : null;

      if (secondArg && !qualityFilter) {
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

      let totalGold = 0;
      let totalItemsSold = 0;
      let commonSold = 0;
      let rareSold = 0;
      let legendarySold = 0;

      const remainingInventory = [];

      inventory.forEach((item) => {
        const itemQuality = item.quality || "Common";
        const matchesFilter = !qualityFilter || itemQuality === qualityFilter;

        if (!matchesFilter || !canSellItem(item)) {
          remainingInventory.push(item);
          return;
        }

        const quantity = sellableQuantity(item);
        const sellPrice = getSellPrice(item);
        const earnedGold = sellPrice * quantity;

        totalGold += earnedGold;
        totalItemsSold += quantity;

        if (itemQuality === "Rare") rareSold += quantity;
        else if (itemQuality === "Legendary") legendarySold += quantity;
        else commonSold += quantity;
      });

      if (totalItemsSold <= 0) {
        return {
          ok: false,
          message: "❌ No sellable items found.",
        };
      }

      const newGold = Number(player.gold || 0) + totalGold;

      transaction.update(playerRef, {
        gold: newGold,
        inventory: remainingInventory,
      });

      return {
        ok: true,
        bulk: true,
        totalGold,
        totalItemsSold,
        commonSold,
        rareSold,
        legendarySold,
        newGold,
      };
    }

    const itemId = action;
    const quantityArg = secondArg || "1";

    const itemIndex = inventory.findIndex(
      (item) => item.id.toLowerCase() === itemId.toLowerCase()
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
        message: "❌ This item cannot be sold.",
      };
    }

    const ownedQuantity = sellableQuantity(item);
    const quantity = quantityArg === "all" ? ownedQuantity : parseInt(quantityArg) || 1;

    if (quantity <= 0) {
      return {
        ok: false,
        message: "❌ Quantity must be greater than 0.",
      };
    }

    if (ownedQuantity < quantity) {
      return {
        ok: false,
        message: `❌ You only have **${ownedQuantity}x** of this item.`,
      };
    }

    const sellPrice = getSellPrice(item);
    const totalGold = sellPrice * quantity;
    const newGold = Number(player.gold || 0) + totalGold;

    if (ownedQuantity > quantity) {
      inventory[itemIndex].quantity = ownedQuantity - quantity;
    } else {
      inventory.splice(itemIndex, 1);
    }

    transaction.update(playerRef, {
      gold: newGold,
      inventory,
    });

    return {
      ok: true,
      bulk: false,
      item,
      quantity,
      sellPrice,
      totalGold,
      newGold,
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
        `🟠 Legendary Sold: **${result.legendarySold}**\n` +
        `💰 Gold Earned: **${result.totalGold}**\n` +
        `🪙 New Gold Balance: **${result.newGold}**`
    );
  }

  const qualityEmoji = getQualityEmoji(result.item.quality || "Common");

  return message.reply(
    `${result.item.emoji || "📦"} Sold **${result.item.name} x${result.quantity}**!\n\n` +
      `Quality: **${qualityEmoji} ${result.item.quality || "Common"}**\n` +
      `💰 Sell Price Each: **${result.sellPrice} Gold**\n` +
      `💰 Gold Earned: **${result.totalGold} Gold**\n` +
      `🪙 New Gold Balance: **${result.newGold}**`
  );
};
