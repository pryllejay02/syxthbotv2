const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");

function getSellPrice(item) {
  const basePrice = Number(item.price || 0);

  if (basePrice <= 0) return 0;

  // Sell value = 50% of item price
  return Math.floor(basePrice * 0.5);
}

module.exports = async function sellCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const itemId = args[0];
  const quantity = parseInt(args[1]) || 1;

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID.\n\nExample: `!s sell archer_iron_weapon 1`"
    );
  }

  if (quantity <= 0) {
    return message.reply("❌ Quantity must be greater than 0.");
  }

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();
  const inventory = player.inventory || [];

  const itemIndex = inventory.findIndex(
    (item) => item.id.toLowerCase() === itemId.toLowerCase()
  );

  if (itemIndex === -1) {
    return message.reply("❌ You don’t have that item in your inventory.");
  }

  const item = inventory[itemIndex];

  if (item.quality === "Starter") {
    return message.reply("❌ You cannot sell starter equipment.");
  }

  const ownedQuantity = Number(item.quantity || 1);

  if (ownedQuantity < quantity) {
    return message.reply(
      `❌ You only have **${ownedQuantity}x** of this item.`
    );
  }

  const sellPrice = getSellPrice(item);

  if (sellPrice <= 0) {
    return message.reply("❌ This item cannot be sold.");
  }

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

  const qualityEmoji = getQualityEmoji(item.quality);

  return message.reply(
    `${item.emoji || "📦"} Sold **${item.name} x${quantity}**!\n\n` +
      `Quality: **${qualityEmoji} ${item.quality || "Common"}**\n` +
      `💰 Gold Earned: **${totalGold}**\n` +
      `🪙 New Gold Balance: **${newGold}**`
  );
};