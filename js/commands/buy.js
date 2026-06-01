const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");

const MAX_BUY_QUANTITY = Number(balanceConfig.shop?.maxBuyQuantity || 99);

function canUseItem(player, item) {
  if (!item.compatibleClasses) return true;
  if (item.compatibleClasses.includes("all")) return true;

  return item.compatibleClasses.includes(player.classId);
}

function parseBuyQuantity(value) {
  const quantity = Number(value || 1);

  if (!Number.isInteger(quantity)) return null;
  if (quantity <= 0) return null;
  if (quantity > MAX_BUY_QUANTITY) return null;

  return quantity;
}

module.exports = async function buyCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const itemId = String(args[0] || "").toLowerCase();
  const quantity = parseBuyQuantity(args[1]);

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID.\n\nExample: `!s buy archer_iron_weapon 1`"
    );
  }

  if (!quantity) {
    return message.reply(
      `❌ Invalid quantity.\n\n` +
        `Quantity must be a whole number from **1** to **${MAX_BUY_QUANTITY}**.`
    );
  }

  const item = shopItems.find(
    (shopItem) =>
      shopItem.id &&
      String(shopItem.id).toLowerCase() === itemId
  );

  if (!item) {
    return message.reply("❌ Item not found in the shop.");
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

    if (!canUseItem(player, item)) {
      return {
        ok: false,
        message:
          `❌ This item is not compatible with your class.\n\n` +
          `Your Class: **${player.class || "Unknown"}**`,
      };
    }

    const playerLevel = Number(player.level ?? 1);
    const requiredLevel = Number(item.requiredLevel ?? 1);

    if (playerLevel < requiredLevel) {
      return {
        ok: false,
        message:
          `🔒 You cannot buy this item yet.\n\n` +
          `Item Required Level: **Lv.${requiredLevel}**\n` +
          `Your Level: **Lv.${playerLevel}**`,
      };
    }

    const playerGold = Number(player.gold ?? 0);
    const itemPrice = Number(item.price || 0);
    const totalCost = itemPrice * quantity;

    if (playerGold < totalCost) {
      return {
        ok: false,
        message:
          `💰 You don't have enough gold.\n\n` +
          `Required: **${totalCost} Gold**\n` +
          `Your Gold: **${playerGold}**`,
      };
    }

    const inventory = [...(player.inventory || [])];

    const quality = item.quality || "Common";
    const qualityEmoji = getQualityEmoji(quality);

    const itemData = {
      id: item.id,
      baseItemId: item.baseItemId || item.id,
      name: item.name,
      type: item.type,
      quality,
      qualityEmoji,
      requiredLevel: Number(item.requiredLevel || 1),
      compatibleClasses: item.compatibleClasses || ["all"],
      quantity,
      price: itemPrice,
      description: item.description || "",
      healPercent: Number(item.healPercent || 0),
      healAmount: Number(item.healAmount || item.heal || 0),
      stats: item.stats || {
        attack: 0,
        defense: 0,
        maxHp: 0,
        dodge: 0,
        crit: 0,
      },
      source: item.source || "shop",
      emoji: item.emoji || "📦",
    };

    const existingItemIndex = inventory.findIndex(
      (invItem) =>
        invItem.id === item.id &&
        invItem.quality === quality &&
        JSON.stringify(invItem.stats || {}) ===
          JSON.stringify(itemData.stats || {})
    );

    if (existingItemIndex !== -1) {
      inventory[existingItemIndex] = {
        ...inventory[existingItemIndex],
        ...itemData,
        quantity:
          Number(inventory[existingItemIndex].quantity || 0) + quantity,
      };
    } else {
      inventory.push(itemData);
    }

    const newGold = playerGold - totalCost;

    transaction.update(playerRef, {
      gold: newGold,
      inventory,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      player,
      totalCost,
      newGold,
      itemData,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Purchase failed.");
  }

  const qualityEmoji = getQualityEmoji(item.quality || "Common");

  return message.reply(
    `${item.emoji || "📦"} ${qualityEmoji} You bought **${item.name} x${quantity}**!\n\n` +
      `🏷️ Quality: **${qualityEmoji} ${item.quality || "Common"}**\n` +
      `🎭 Class: **${(item.compatibleClasses || ["all"]).join(", ")}**\n` +
      `🔓 Required Level: **Lv.${item.requiredLevel || 1}**\n` +
      `💰 Gold Spent: **${result.totalCost}**\n` +
      `🪙 Remaining Gold: **${result.newGold}**\n\n` +
      `🎒 Item added to your inventory.`
  );
};