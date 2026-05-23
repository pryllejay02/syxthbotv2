const { db } = require("../../firebase/firebase");

module.exports = async function useCommand(message, args) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  const itemId = args[0];

  if (!itemId) {
    return message.reply("❌ Please specify an item.\n\nExample: `!s use hp_potion`");
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

  if (item.type !== "Consumable") {
    return message.reply("❌ This item is not consumable.");
  }

  if (item.id === "hp_potion") {
    const hp = Number(player.hp ?? 100);
    const maxHp = Number(player.maxHp ?? 100);

    if (hp <= 0) {
      return message.reply("💀 You cannot use HP Potion while defeated. Use `!s rest` or wait for revival.");
    }

    if (hp >= maxHp) {
      return message.reply("❤️ Your HP is already full.");
    }

    const healPercent = Number(item.healPercent || 50);
    const healAmount = Math.floor(maxHp * (healPercent / 100));
    const newHp = Math.min(maxHp, hp + healAmount);

    inventory[itemIndex].quantity -= 1;

    if (inventory[itemIndex].quantity <= 0) {
      inventory.splice(itemIndex, 1);
    }

    await playerRef.update({
      hp: newHp,
      inventory: inventory,
    });

    return message.reply(
      `🧪 You used **${item.name}**!\n\n` +
      `❤️ HP Restored: ${newHp - hp}\n` +
      `❤️ Current HP: ${newHp}/${maxHp}`
    );
  }

  return message.reply("❌ This consumable item has no effect yet.");
};