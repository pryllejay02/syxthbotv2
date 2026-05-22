const { db } = require("../../firebase/firebase");

function getSlot(type) {
  const itemType = String(type || "").toLowerCase();

  if (itemType === "weapon") return "weapon";
  if (itemType === "helmet") return "helmet";
  if (itemType === "armor") return "armor";
  if (itemType === "gloves") return "gloves";
  if (itemType === "pants") return "pants";
  if (itemType === "boots") return "boots";

  return null;
}

function calculateTotalStats(baseStats, equipment) {
  let totalAttack = Number(baseStats.attack || 10);
  let totalDefense = Number(baseStats.defense || 5);
  let totalMaxHp = Number(baseStats.maxHp || 100);

  Object.values(equipment).forEach((item) => {
    if (!item || !item.stats) return;

    totalAttack += Number(item.stats.attack || 0);
    totalDefense += Number(item.stats.defense || 0);
    totalMaxHp += Number(item.stats.maxHp || 0);
  });

  return {
    attack: totalAttack,
    defense: totalDefense,
    maxHp: totalMaxHp,
  };
}

module.exports = async function equipCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const itemId = args[0];

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID.\n\nExample: `!s equip common_iron_sword`"
    );
  }

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();
  const inventory = player.inventory || [];

  const itemIndex = inventory.findIndex((item) => item.id === itemId);

  if (itemIndex === -1) {
    return message.reply("❌ You don’t have that item in your inventory.");
  }

  const item = inventory[itemIndex];
  const slot = getSlot(item.type);

  if (!slot) {
    return message.reply("❌ This item cannot be equipped.");
  }

  const playerLevel = Number(player.level || 1);
  const requiredLevel = Number(item.requiredLevel || 1);

  if (playerLevel < requiredLevel) {
    return message.reply(
      `🔒 You cannot equip this item yet.\n\n` +
        `Required Level: **Lv.${requiredLevel}**\n` +
        `Your Level: **Lv.${playerLevel}**`
    );
  }

  const equipment = player.equipment || {
    weapon: null,
    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };

  const oldEquippedItem = equipment[slot];

  if (oldEquippedItem) {
    const existingOldItemIndex = inventory.findIndex(
      (invItem) => invItem.id === oldEquippedItem.id
    );

    if (existingOldItemIndex !== -1) {
      inventory[existingOldItemIndex].quantity =
        Number(inventory[existingOldItemIndex].quantity || 0) + 1;
    } else {
      inventory.push({
        ...oldEquippedItem,
        quantity: 1,
      });
    }
  }

  if (inventory[itemIndex].quantity > 1) {
    inventory[itemIndex].quantity -= 1;
  } else {
    inventory.splice(itemIndex, 1);
  }

  const baseStats = player.baseStats || {
    attack: Number(player.attack || 10),
    defense: Number(player.defense || 5),
    maxHp: Number(player.maxHp || 100),
  };

  equipment[slot] = {
    id: item.id,
    name: item.name,
    type: item.type,
    quality: item.quality || "Common",
    requiredLevel: item.requiredLevel || 1,
    stats: item.stats || {
      attack: 0,
      defense: 0,
      maxHp: 0,
    },
    emoji: item.emoji || "📦",
  };

  const totalStats = calculateTotalStats(baseStats, equipment);

  const oldMaxHp = Number(player.maxHp || baseStats.maxHp);
  const currentHp = Number(player.hp || oldMaxHp);
  const hpDifference = totalStats.maxHp - oldMaxHp;
  const newHp = Math.min(
    totalStats.maxHp,
    currentHp + Math.max(0, hpDifference)
  );

  await playerRef.update({
    baseStats: baseStats,
    equipment: equipment,
    inventory: inventory,
    attack: totalStats.attack,
    defense: totalStats.defense,
    maxHp: totalStats.maxHp,
    hp: newHp,
  });

  return message.reply(
    `${item.emoji || "📦"} Equipped **${item.name}**!\n\n` +
      `Slot: **${slot.toUpperCase()}**\n` +
      `⚔️ Attack: ${totalStats.attack}\n` +
      `🛡️ Defense: ${totalStats.defense}\n` +
      `❤️ Max HP: ${totalStats.maxHp}`
  );
};