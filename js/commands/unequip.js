const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const { getQualityEmoji } = require("../utils/qualitySystem");

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
    return message.reply(`❌ You have no item equipped in **${slot}**.`);
  }

  if (item.quality === "Starter") {
    return message.reply(
      "❌ You cannot unequip your starter weapon unless you equip another weapon first."
    );
  }

  const qualityEmoji = getQualityEmoji(item.quality);

  equipment[slot] = null;

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
    dodge: Number(player.dodge || 0),
    crit: Number(player.crit || 0),
  };

  const totalStats = calculateTotalStats(baseStats, equipment);

  const currentHp = Number(player.hp || totalStats.maxHp);
  const newHp = Math.min(currentHp, totalStats.maxHp);

  await playerRef.update({
    baseStats,
    equipment,
    inventory,

    attack: totalStats.attack,
    defense: totalStats.defense,
    maxHp: totalStats.maxHp,
    dodge: totalStats.dodge,
    crit: totalStats.crit,

    hp: newHp,
  });

  return message.reply(
    `${item.emoji || "📦"} ${qualityEmoji} Unequipped **${item.name}** from **${slot}**.\n\n` +
      `Quality: **${qualityEmoji} ${item.quality || "Common"}**\n` +
      `⚔️ Attack: ${totalStats.attack}\n` +
      `🛡️ Defense: ${totalStats.defense}\n` +
      `❤️ Max HP: ${totalStats.maxHp}\n` +
      `💨 Dodge: ${Number(totalStats.dodge || 0).toFixed(1)}%\n` +
      `💥 Crit: ${Number(totalStats.crit || 0).toFixed(1)}%`
  );
};