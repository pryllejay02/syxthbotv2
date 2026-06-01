const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");

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

function canUseItem(player, item) {
  if (!item.compatibleClasses) return true;
  if (item.compatibleClasses.includes("all")) return true;

  return item.compatibleClasses.includes(player.classId);
}

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

function shouldReturnOldItemToInventory(item) {
  if (!item) return false;
  if (item.quality === "Starter") return false;
  if (item.isStarter) return false;

  return true;
}

module.exports = async function equipCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const itemId = args[0];

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID.\n\nExample: `!s equip archer_iron_weapon`"
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
    const inventory = [...(player.inventory || [])];

    const itemIndex = inventory.findIndex(
      (item) =>
        item.id &&
        item.id.toLowerCase() === String(itemId).toLowerCase()
    );

    if (itemIndex === -1) {
      return {
        ok: false,
        message: "❌ You don’t have that item in your inventory.",
      };
    }

    const item = inventory[itemIndex];

    if (String(item.type || "").toLowerCase() === "consumable") {
      return {
        ok: false,
        message:
          "❌ Consumables cannot be equipped. Use `!s use <item_id>` instead.",
      };
    }

    const slot = getSlot(item.type);
    const qualityEmoji = getQualityEmoji(item.quality);

    if (!slot) {
      return {
        ok: false,
        message: "❌ This item cannot be equipped.",
      };
    }

    if (!canUseItem(player, item)) {
      return {
        ok: false,
        message:
          `❌ This item is not compatible with your class.\n\n` +
          `Your Class: **${player.class || "Unknown"}**`,
      };
    }

    const playerLevel = Number(player.level || 1);
    const requiredLevel = Number(item.requiredLevel || 1);

    if (playerLevel < requiredLevel) {
      return {
        ok: false,
        message:
          `🔒 You cannot equip this item yet.\n\n` +
          `Required Level: **Lv.${requiredLevel}**\n` +
          `Your Level: **Lv.${playerLevel}**`,
      };
    }

    const equipment = {
      ...getDefaultEquipment(),
      ...(player.equipment || {}),
    };

    const oldEquippedItem = equipment[slot];

    if (shouldReturnOldItemToInventory(oldEquippedItem)) {
      const existingOldItemIndex = inventory.findIndex(
        (invItem) =>
          invItem.id === oldEquippedItem.id &&
          JSON.stringify(invItem.stats || {}) ===
            JSON.stringify(oldEquippedItem.stats || {})
      );

      if (existingOldItemIndex !== -1) {
        inventory[existingOldItemIndex].equipped = false;
        inventory[existingOldItemIndex].isEquipped = false;
        inventory[existingOldItemIndex].quantity =
          Number(inventory[existingOldItemIndex].quantity || 0) + 1;
      } else {
        inventory.push({
          ...oldEquippedItem,
          equipped: false,
          isEquipped: false,
          quantity: 1,
        });
      }
    }

    if (Number(inventory[itemIndex].quantity || 1) > 1) {
      inventory[itemIndex].quantity =
        Number(inventory[itemIndex].quantity || 1) - 1;
    } else {
      inventory.splice(itemIndex, 1);
    }

    const baseStats = getBaseStats(player);

    equipment[slot] = {
      id: item.id,
      baseItemId: item.baseItemId || item.id,
      name: item.name,
      type: item.type,
      quality: item.quality || "Common",
      qualityEmoji,
      requiredLevel: item.requiredLevel || 1,
      compatibleClasses: item.compatibleClasses || ["all"],
      stats: item.stats || {
        attack: 0,
        defense: 0,
        maxHp: 0,
        dodge: 0,
        crit: 0,
      },
      price: Number(item.price || 0),
      description: item.description || "",
      source: item.source || "unknown",
      emoji: item.emoji || "📦",
      quantity: 1,
    };

    const totalStats = calculateTotalStats(baseStats, equipment);

    const oldMaxHp = Number(player.maxHp || baseStats.maxHp);
    const currentHp = Number(player.hp || oldMaxHp);
    const hpDifference = Number(totalStats.maxHp || 100) - oldMaxHp;

    const newHp =
      currentHp <= 0
        ? 0
        : Math.min(
            Number(totalStats.maxHp || 100),
            currentHp + Math.max(0, hpDifference)
          );

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
    return message.reply(result.message || "❌ Equip failed.");
  }

  return message.reply(
    `${result.item.emoji || "📦"} Equipped **${result.item.name}**!\n\n` +
      `Slot: **${result.slot.toUpperCase()}**\n` +
      `Quality: **${result.qualityEmoji} ${result.item.quality || "Common"}**\n` +
      `❤️ HP: ${result.newHp}/${result.totalStats.maxHp}\n` +
      `⚔️ Attack: ${result.totalStats.attack}\n` +
      `🛡️ Defense: ${result.totalStats.defense}\n` +
      `💨 Dodge: ${Number(result.totalStats.dodge || 0).toFixed(1)}%\n` +
      `💥 Crit: ${Number(result.totalStats.crit || 0).toFixed(1)}%`
  );
};