const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");

function getSellPrice(item) {
  const basePrice = Number(item.price || 0);

  if (basePrice <= 0) return 0;

  if (item.quality === "Rare") {
    return Math.floor(basePrice * 0.75);
  }

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

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();
  const inventory = player.inventory || [];

  if (inventory.length === 0) {
    return message.reply("❌ Your inventory is empty.");
  }

  // SELL ALL / SELL ALL COMMON / SELL ALL RARE
  if (action === "all") {
    const qualityFilter =
      secondArg === "common"
        ? "Common"
        : secondArg === "rare"
        ? "Rare"
        : null;

    if (secondArg && !qualityFilter) {
      return message.reply(
        "❌ Invalid sell filter.\n\nUse:\n" +
          "`!s sell all`\n" +
          "`!s sell all common`\n" +
          "`!s sell all rare`"
      );
    }

    let totalGold = 0;
    let totalItemsSold = 0;
    let commonSold = 0;
    let rareSold = 0;

    const remainingInventory = [];

    inventory.forEach((item) => {
      const itemQuality = item.quality || "Common";

      const matchesFilter =
        !qualityFilter || itemQuality === qualityFilter;

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
      else commonSold += quantity;
    });

    if (totalItemsSold <= 0) {
      return message.reply("❌ No sellable items found.");
    }

    const newGold = Number(player.gold || 0) + totalGold;

    await playerRef.update({
      gold: newGold,
      inventory: remainingInventory,
    });

    return message.reply(
      `💰 **Bulk Sell Complete!**\n\n` +
        `📦 Items Sold: **${totalItemsSold}**\n` +
        `🟢 Common Sold: **${commonSold}**\n` +
        `🔵 Rare Sold: **${rareSold}**\n` +
        `💰 Gold Earned: **${totalGold}**\n` +
        `🪙 New Gold Balance: **${newGold}**`
    );
  }

  // SELL SPECIFIC ITEM
  const itemId = action;
  const quantityArg = secondArg || "1";

  const itemIndex = inventory.findIndex(
    (item) => item.id.toLowerCase() === itemId.toLowerCase()
  );

  if (itemIndex === -1) {
    return message.reply("❌ You don’t have that item in your inventory.");
  }

  const item = inventory[itemIndex];

  if (!canSellItem(item)) {
    return message.reply("❌ This item cannot be sold.");
  }

  const ownedQuantity = sellableQuantity(item);

  const quantity =
    quantityArg === "all"
      ? ownedQuantity
      : parseInt(quantityArg) || 1;

  if (quantity <= 0) {
    return message.reply("❌ Quantity must be greater than 0.");
  }

  if (ownedQuantity < quantity) {
    return message.reply(
      `❌ You only have **${ownedQuantity}x** of this item.`
    );
  }

  const sellPrice = getSellPrice(item);
  const totalGold = sellPrice * quantity;
  const newGold = Number(player.gold || 0) + totalGold;

  if (ownedQuantity > quantity) {
    inventory[itemIndex].quantity = ownedQuantity - quantity;
  } else {
    inventory.splice(itemIndex, 1);
  }

  await playerRef.update({
    gold: newGold,
    inventory,
  });

  const qualityEmoji = getQualityEmoji(item.quality || "Common");

  return message.reply(
    `${item.emoji || "📦"} Sold **${item.name} x${quantity}**!\n\n` +
      `Quality: **${qualityEmoji} ${item.quality || "Common"}**\n` +
      `💰 Sell Price Each: **${sellPrice} Gold**\n` +
      `💰 Gold Earned: **${totalGold} Gold**\n` +
      `🪙 New Gold Balance: **${newGold}**`
  );
};