const { db } = require("../../firebase/firebase");

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

module.exports = async function unequipCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const slot = String(args[0] || "").toLowerCase();

  const validSlots = [
    "weapon",
    "helmet",
    "armor",
    "gloves",
    "pants",
    "boots",
  ];

  if (!slot || !validSlots.includes(slot)) {
    return message.reply(
      "❌ Please specify a valid slot.\n\n" +
        "Example: `!s unequip weapon`\n\n" +
        "Slots: `weapon`, `helmet`, `armor`, `gloves`, `pants`, `boots`"
    );
  }

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();

  const equipment = player.equipment || {
    weapon: null,
    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };

  const item = equipment[slot];

  if (!item) {
    return message.reply(
      `❌ You have no item equipped in **${slot}**.`
    );
  }

  // REMOVE EQUIPPED ITEM
  equipment[slot] = null;

  // RETURN ITEM TO INVENTORY
  const inventory = player.inventory || [];

  const existingItemIndex = inventory.findIndex(
    (invItem) => invItem.id === item.id
  );

  if (existingItemIndex !== -1) {
    inventory[existingItemIndex].quantity =
      Number(inventory[existingItemIndex].quantity || 0) + 1;
  } else {
    inventory.push({
      ...item,
      quantity: 1,
    });
  }

  const baseStats = player.baseStats || {
    attack: Number(player.attack || 10),
    defense: Number(player.defense || 5),
    maxHp: Number(player.maxHp || 100),
  };

  const totalStats = calculateTotalStats(baseStats, equipment);

  const currentHp = Number(player.hp || totalStats.maxHp);
  const newHp = Math.min(currentHp, totalStats.maxHp);

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
    `${item.emoji || "📦"} Unequipped **${item.name}** from **${slot}**.\n\n` +
      `⚔️ Attack: ${totalStats.attack}\n` +
      `🛡️ Defense: ${totalStats.defense}\n` +
      `❤️ Max HP: ${totalStats.maxHp}`
  );
};