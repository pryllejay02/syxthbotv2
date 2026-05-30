const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const { getQualityEmoji } = require("../utils/qualitySystem");

function getDefaultEquipment() {
  return {
    weapon: null,
    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };
}

module.exports = async function unequipCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const slot = String(args[0] || "").toLowerCase();

  const validSlots = ["weapon", "helmet", "armor", "gloves", "pants", "boots"];

  if (!slot || !validSlots.includes(slot)) {
    return message.reply(
      "❌ Please specify a valid slot.\n\n" +
        "Example: `!s unequip weapon`\n\n" +
        "Slots: `weapon`, `helmet`, `armor`, `gloves`, `pants`, `boots`"
    );
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
    const equipment = {
      ...getDefaultEquipment(),
      ...(player.equipment || {}),
    };

    const item = equipment[slot];

    if (!item) {
      return {
        ok: false,
        message: `❌ You have no item equipped in **${slot}**.`,
      };
    }

    if (item.quality === "Starter") {
      return {
        ok: false,
        message: "❌ You cannot unequip your starter weapon unless you equip another weapon first.",
      };
    }

    const qualityEmoji = getQualityEmoji(item.quality);

    equipment[slot] = null;

    const inventory = [...(player.inventory || [])];

    const existingItemIndex = inventory.findIndex((invItem) => invItem.id === item.id);

    if (existingItemIndex !== -1) {
      inventory[existingItemIndex].quantity =
        Number(inventory[existingItemIndex].quantity || 0) + 1;
    } else {
      inventory.push({
        ...item,
        equipped: false,
        isEquipped: false,
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

    transaction.update(playerRef, {
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

    return {
      ok: true,
      item,
      slot,
      qualityEmoji,
      totalStats,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Unequip failed.");
  }

  return message.reply(
    `${result.item.emoji || "📦"} Unequipped **${result.item.name}** from **${result.slot}**.\n\n` +
      `Quality: **${result.qualityEmoji} ${result.item.quality || "Common"}**\n` +
      `⚔️ Attack: ${result.totalStats.attack}\n` +
      `🛡️ Defense: ${result.totalStats.defense}\n` +
      `❤️ Max HP: ${result.totalStats.maxHp}\n` +
      `💨 Dodge: ${Number(result.totalStats.dodge || 0).toFixed(1)}%\n` +
      `💥 Crit: ${Number(result.totalStats.crit || 0).toFixed(1)}%`
  );
};
