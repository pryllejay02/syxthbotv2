const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");

module.exports = async function buyCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();

  const itemId = args[0];
  const quantity = parseInt(args[1]) || 1;

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID.\n\nExample: `!s buy hp_potion 5`"
    );
  }

  if (quantity <= 0) {
    return message.reply("❌ Quantity must be greater than 0.");
  }

  const item = shopItems.find(
    (shopItem) => shopItem.id.toLowerCase() === itemId.toLowerCase()
  );

  if (!item) {
    return message.reply("❌ Item not found in the shop.");
  }

  const playerLevel = Number(player.level ?? 1);
  const requiredLevel = Number(item.requiredLevel ?? 1);

  if (playerLevel < requiredLevel) {
    return message.reply(
      `🔒 You cannot buy this item yet.\n\n` +
      `Item Required Level: **Lv.${requiredLevel}**\n` +
      `Your Level: **Lv.${playerLevel}**`
    );
  }

  const playerGold = Number(player.gold ?? 0);
  const totalCost = Number(item.price) * quantity;

  if (playerGold < totalCost) {
    return message.reply(
      `💰 You don't have enough gold.\n\n` +
      `Required: ${totalCost} Gold\n` +
      `Your Gold: ${playerGold}`
    );
  }

  const inventory = player.inventory || [];

  const existingItemIndex = inventory.findIndex(
    (invItem) => invItem.id === item.id
  );

if (existingItemIndex !== -1) {
  inventory[existingItemIndex] = {
    ...inventory[existingItemIndex],
    id: item.id,
    name: item.name,
    type: item.type,
    quality: item.quality || "Common",
    requiredLevel: item.requiredLevel || 1,
    quantity: Number(inventory[existingItemIndex].quantity || 0) + quantity,
    price: item.price || 0,
    description: item.description || "",
    healPercent: item.healPercent || 0,
    stats: item.stats || {
      attack: 0,
      defense: 0,
      maxHp: 0,
    },
    emoji: item.emoji || "📦",
  };
} else {
  inventory.push({
    id: item.id,
    name: item.name,
    type: item.type,
    quality: item.quality || "Common",
    requiredLevel: item.requiredLevel || 1,
    quantity: quantity,
    price: item.price || 0,
    description: item.description || "",
    healPercent: item.healPercent || 0,
    stats: item.stats || {
      attack: 0,
      defense: 0,
      maxHp: 0,
    },
    emoji: item.emoji || "📦",
  });
}
  const newGold = playerGold - totalCost;

  await playerRef.update({
    gold: newGold,
    inventory: inventory,
  });

  return message.reply(
    `${item.emoji || "📦"} You bought **${item.name} x${quantity}**!\n\n` +
    `🏷️ Quality: **${item.quality || "Common"}**\n` +
    `🔓 Required Level: **Lv.${item.requiredLevel || 1}**\n` +
    `💰 Gold Spent: **${totalCost}**\n` +
    `🪙 Remaining Gold: **${newGold}**\n\n` +
    `🎒 Item added to your inventory.`
  );
};