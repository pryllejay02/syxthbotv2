const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");

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

function getBaseStats(player) {
  if (player.baseStats) {
    return {
      attack: Number(player.baseStats.attack || 10),
      defense: Number(player.baseStats.defense || 5),
      maxHp: Number(player.baseStats.maxHp || 100),
      dodge: Number(player.baseStats.dodge || 0),
      crit: Number(player.baseStats.crit || 0),
    };
  }

  return balanceConfig.getBaseStatsByClassLevel(
    player.classId || "swordsman",
    Number(player.level || 1)
  );
}

function shouldReturnItemToInventory(item) {
  if (!item) return false;
  if (item.quality === "Starter") return false;
  if (item.isStarter) return false;

  return true;
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

    if (item.quality === "Starter" || item.isStarter) {
      return {
        ok: false,
        message:
          "❌ You cannot unequip your starter weapon unless you equip another weapon first.",
      };
    }

    const qualityEmoji = getQualityEmoji(item.quality);

    equipment[slot] = null;

    const inventory = [...(player.inventory || [])];

    if (shouldReturnItemToInventory(item)) {
      const existingItemIndex = inventory.findIndex(
        (invItem) =>
          invItem.id === item.id &&
          JSON.stringify(invItem.stats || {}) ===
            JSON.stringify(item.stats || {})
      );

      if (existingItemIndex !== -1) {
        inventory[existingItemIndex].equipped = false;
        inventory[existingItemIndex].isEquipped = false;
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
    }

    const baseStats = getBaseStats(player);
    const totalStats = calculateTotalStats(baseStats, equipment);

    const currentHp = Number(player.hp || totalStats.maxHp);

    const newHp =
      currentHp <= 0
        ? 0
        : Math.min(currentHp, Number(totalStats.maxHp || 100));

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
      updatedAt: new Date(),
    });

    return {
      ok: true,
      item,
      slot,
      qualityEmoji,
      totalStats,
      newHp,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Unequip failed.");
  }

  return message.reply(
    `${result.item.emoji || "📦"} Unequipped **${result.item.name}** from **${result.slot}**.\n\n` +
      `Quality: **${result.qualityEmoji} ${result.item.quality || "Common"}**\n` +
      `❤️ HP: ${result.newHp}/${result.totalStats.maxHp}\n` +
      `⚔️ Attack: ${result.totalStats.attack}\n` +
      `🛡️ Defense: ${result.totalStats.defense}\n` +
      `💨 Dodge: ${Number(result.totalStats.dodge || 0).toFixed(1)}%\n` +
      `💥 Crit: ${Number(result.totalStats.crit || 0).toFixed(1)}%`
  );
};