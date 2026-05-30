const { db } = require("../../firebase/firebase");

module.exports = async function useCommand(message, args) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const itemId = args[0];

  if (!itemId) {
    return message.reply("❌ Please specify an item.\n\nExample: `!s use hp_potion`");
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

    if (item.type !== "Consumable") {
      return {
        ok: false,
        message: "❌ This item is not consumable.",
      };
    }

    if (item.id === "hp_potion") {
      const hp = Number(player.hp ?? 100);
      const maxHp = Number(player.maxHp ?? 100);

      if (hp <= 0) {
        return {
          ok: false,
          message: "💀 You cannot use HP Potion while defeated. Use `!s rest` or wait for revival.",
        };
      }

      if (hp >= maxHp) {
        return {
          ok: false,
          message: "❤️ Your HP is already full.",
        };
      }

      const healPercent = Number(item.healPercent || 50);
      const healAmount = Math.floor(maxHp * (healPercent / 100));
      const newHp = Math.min(maxHp, hp + healAmount);

      inventory[itemIndex].quantity = Number(inventory[itemIndex].quantity || 1) - 1;

      if (inventory[itemIndex].quantity <= 0) {
        inventory.splice(itemIndex, 1);
      }

      transaction.update(playerRef, {
        hp: newHp,
        inventory,
      });

      return {
        ok: true,
        item,
        hp,
        maxHp,
        newHp,
      };
    }

    return {
      ok: false,
      message: "❌ This consumable item has no effect yet.",
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Item use failed.");
  }

  return message.reply(
    `🧪 You used **${result.item.name}**!\n\n` +
      `❤️ HP Restored: ${result.newHp - result.hp}\n` +
      `❤️ Current HP: ${result.newHp}/${result.maxHp}`
  );
};
