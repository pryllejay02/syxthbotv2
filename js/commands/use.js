const { db } = require("../../firebase/firebase");

function isConsumable(item) {
  return String(item.type || "").toLowerCase() === "consumable";
}

function getHealAmount(item, maxHp) {
  const healPercent = Number(item.healPercent || 0);
  const healAmount = Number(item.healAmount || item.heal || 0);

  if (healPercent > 0) {
    return Math.max(
      1,
      Math.floor(Number(maxHp || 100) * (healPercent / 100))
    );
  }

  if (healAmount > 0) {
    return Math.floor(healAmount);
  }

  return 0;
}

function removeUsedItemFromInventory(inventory, itemIndex) {
  const item = inventory[itemIndex];
  const quantity = Number(item.quantity || 1);

  if (quantity > 1) {
    inventory[itemIndex] = {
      ...item,
      quantity: quantity - 1,
    };
  } else {
    inventory.splice(itemIndex, 1);
  }

  return inventory;
}

module.exports = async function useCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);
  const battleRef = db.collection("battles").doc(userId);

  const itemId = String(args[0] || "").toLowerCase();

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item.\n\nExample: `!s use hp_potion`"
    );
  }

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    const battleDoc = await transaction.get(battleRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "You don’t have a character yet. Use `!s start` first.",
      };
    }

    const player = playerDoc.data();
    const inventory = [...(player.inventory || [])];

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

    if (!isConsumable(item)) {
      return {
        ok: false,
        message: "❌ This item is not consumable.",
      };
    }

    const hp = Number(player.hp ?? 100);
    const maxHp = Number(player.maxHp ?? 100);

    if (hp <= 0) {
      return {
        ok: false,
        message:
          "💀 You cannot use consumables while defeated. Use `!s rest` or wait for revival.",
      };
    }

    if (hp >= maxHp) {
      return {
        ok: false,
        message: "❤️ Your HP is already full.",
      };
    }

    const healAmount = getHealAmount(item, maxHp);

    if (healAmount <= 0) {
      return {
        ok: false,
        message: "❌ This consumable item has no effect yet.",
      };
    }

    const newHp = Math.min(maxHp, hp + healAmount);
    const actualHealed = newHp - hp;

    removeUsedItemFromInventory(inventory, itemIndex);

    transaction.update(playerRef, {
      hp: newHp,
      inventory,
      updatedAt: new Date(),
    });

    if (battleDoc.exists) {
      transaction.update(battleRef, {
        updatedAt: new Date(),
      });
    }

    return {
      ok: true,
      item,
      oldHp: hp,
      newHp,
      maxHp,
      actualHealed,
      remainingQuantity:
        Number(item.quantity || 1) > 1
          ? Number(item.quantity || 1) - 1
          : 0,
      inBattle: battleDoc.exists,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Item use failed.");
  }

  return message.reply(
    `${result.item.emoji || "🧪"} You used **${result.item.name}**!\n\n` +
      `❤️ HP Restored: **${result.actualHealed}**\n` +
      `❤️ Current HP: **${result.oldHp} → ${result.newHp}/${result.maxHp}**\n` +
      `📦 Remaining: **${result.remainingQuantity}**\n\n` +
      `${
        result.inBattle
          ? "⚔️ You are still in battle. Use `!s hit` or `!s retreat`."
          : "✅ Item consumed."
      }`
  );
};