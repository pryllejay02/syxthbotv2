const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");
const bossConfig = require("../data/bossConfig");
const { getQualityEmoji } = require("../utils/qualitySystem");
const { generateBossDrop } = require("../utils/bossLootSystem");

const MAX_ADMIN_ITEM_QUANTITY = 50;

function getMention(message) {
  return message.mentions.users.first();
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function scaleStatsByQuality(stats, quality) {
  const multiplier =
    quality === "Legendary"
      ? randomBetween(2.1, 2.8)
      : quality === "Rare"
      ? randomBetween(1.35, 1.75)
      : randomBetween(0.9, 1.15);

  return {
    attack: Math.floor((stats.attack || 0) * multiplier),
    defense: Math.floor((stats.defense || 0) * multiplier),
    maxHp: Math.floor((stats.maxHp || 0) * multiplier),
    dodge: Number(((stats.dodge || 0) * multiplier).toFixed(1)),
    crit: Number(((stats.crit || 0) * multiplier).toFixed(1)),
  };
}

function makeDescription(stats) {
  const parts = [];

  if (stats.attack) parts.push(`+${stats.attack} ATK`);
  if (stats.defense) parts.push(`+${stats.defense} DEF`);
  if (stats.maxHp) parts.push(`+${stats.maxHp} HP`);
  if (stats.dodge) parts.push(`+${stats.dodge}% Dodge`);
  if (stats.crit) parts.push(`+${stats.crit}% Crit`);

  return parts.length ? parts.join(", ") : "No bonus stats";
}

function normalizeQuality(input, allowedQualities) {
  return allowedQualities.find(
    (quality) =>
      quality.toLowerCase() === String(input || "").toLowerCase()
  );
}

function parseQuantity(value) {
  const quantity = Number(value || 1);

  if (!Number.isInteger(quantity)) return null;
  if (quantity <= 0) return null;
  if (quantity > MAX_ADMIN_ITEM_QUANTITY) return null;

  return quantity;
}

function generateAdminItem(baseItem, quality) {
  const stats = scaleStatsByQuality(baseItem.stats || {}, quality);
  const qualityEmoji = getQualityEmoji(quality);

  const cleanBaseName = String(baseItem.name || "Unknown Item").replace(
    /^Common /,
    ""
  );

  return {
    ...baseItem,

    id: `${baseItem.id}_${quality.toLowerCase()}_admin_${Date.now()}_${Math.floor(
      Math.random() * 99999
    )}`,

    baseItemId: baseItem.id,

    name:
      quality === "Common"
        ? `Common ${cleanBaseName}`
        : `${quality} ${cleanBaseName}`,

    quality,
    qualityEmoji,

    requiredLevel: baseItem.requiredLevel || 1,
    compatibleClasses: baseItem.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || 0) *
        (quality === "Legendary" ? 5 : quality === "Rare" ? 2 : 1)
    ),

    description: makeDescription(stats),
    stats,

    quantity: 1,
    source: "admin_generated",
  };
}

function addItemToInventory(inventory, item, quantity = 1) {
  const existingIndex = inventory.findIndex(
    (invItem) =>
      invItem.baseItemId === item.baseItemId &&
      invItem.quality === item.quality &&
      JSON.stringify(invItem.stats || {}) === JSON.stringify(item.stats || {})
  );

  if (existingIndex !== -1) {
    inventory[existingIndex].quantity =
      Number(inventory[existingIndex].quantity || 1) + quantity;
  } else {
    inventory.push({
      ...item,
      quantity,
    });
  }

  return inventory;
}

function getBossLevelByIdOrTier(value) {
  const key = String(value || "").toLowerCase();

  if (bossConfig.bosses[key]) {
    return bossConfig.bosses[key][0]?.level || 10;
  }

  for (const bosses of Object.values(bossConfig.bosses)) {
    const found = bosses.find(
      (boss) => boss.id && boss.id.toLowerCase() === key
    );

    if (found) return found.level;
  }

  return null;
}

function formatItemStats(item) {
  return (
    `⚔️ ${item.stats?.attack || 0} | ` +
    `🛡️ ${item.stats?.defense || 0} | ` +
    `❤️ ${item.stats?.maxHp || 0} | ` +
    `💨 ${item.stats?.dodge || 0}% | ` +
    `💥 ${item.stats?.crit || 0}%`
  );
}

module.exports = async function adminItems(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (!target || target.bot) {
    return message.reply("❌ Please mention a valid player.");
  }

  const playerRef = db.collection("players").doc(target.id);

  if (subCommand === "giveitem") {
    const itemId = args[2];
    const qualityInput = args[3] || "Common";
    const quantity = parseQuantity(args[4] || 1);

    if (!itemId || !quantity) {
      return message.reply(
        "❌ Usage: `!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>`\n" +
          `Quantity must be from **1-${MAX_ADMIN_ITEM_QUANTITY}**.`
      );
    }

    const validQuality = normalizeQuality(qualityInput, [
      "Common",
      "Rare",
      "Legendary",
    ]);

    if (!validQuality) {
      return message.reply(
        "❌ Quality must be `Common`, `Rare`, or `Legendary`."
      );
    }

    const baseItem = shopItems.find(
      (shopItem) =>
        shopItem.id.toLowerCase() === String(itemId).toLowerCase()
    );

    if (!baseItem) {
      return message.reply("❌ Item not found in shopItems.");
    }

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const inventory = [...(player.inventory || [])];
      const givenItems = [];

      for (let i = 0; i < quantity; i++) {
        const item = generateAdminItem(baseItem, validQuality);

        addItemToInventory(inventory, item, 1);
        givenItems.push(item);
      }

      transaction.update(playerRef, {
        inventory,
      });

      return {
        ok: true,
        givenItems,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Give item failed.");
    }

    const exampleItem = result.givenItems[0];
    const cleanBaseName = String(baseItem.name || "Unknown Item").replace(
      /^Common /,
      ""
    );

    return message.reply(
      `✅ Gave **${quantity}x ${validQuality} ${cleanBaseName}** to ${target.username}.\n\n` +
        `🎁 Example Roll: **${exampleItem.qualityEmoji} ${exampleItem.name}**\n` +
        `🏷️ ID: \`${exampleItem.id}\`\n` +
        `📊 Stats: ${formatItemStats(exampleItem)}`
    );
  }

  if (subCommand === "givebossitem") {
    const bossOrTier = args[2];
    const qualityInput = args[3];
    const quantity = parseQuantity(args[4] || 1);

    if (!bossOrTier || !qualityInput || !quantity) {
      return message.reply(
        "❌ Usage: `!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>`\n" +
          `Quantity must be from **1-${MAX_ADMIN_ITEM_QUANTITY}**.`
      );
    }

    const validQuality = normalizeQuality(qualityInput, [
      "Rare",
      "Legendary",
    ]);

    if (!validQuality) {
      return message.reply("❌ Quality must be `Rare` or `Legendary`.");
    }

    const bossLevel = getBossLevelByIdOrTier(bossOrTier);

    if (!bossLevel) {
      return message.reply("❌ Boss ID or tier not found.");
    }

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ Character not found.",
        };
      }

      const player = playerDoc.data();
      const inventory = [...(player.inventory || [])];
      const givenItems = [];

      for (let i = 0; i < quantity; i++) {
        const item = generateBossDrop(bossLevel, validQuality);

        if (!item) {
          return {
            ok: false,
            message:
              "❌ Failed to generate boss item. Check shop item levels.",
          };
        }

        addItemToInventory(inventory, item, 1);
        givenItems.push(item);
      }

      transaction.update(playerRef, {
        inventory,
      });

      return {
        ok: true,
        givenItems,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Give boss item failed.");
    }

    const exampleItem = result.givenItems[0];

    return message.reply(
      `✅ Gave **${quantity}x ${validQuality} boss item(s)** to ${target.username}.\n\n` +
        `🎁 Example Roll: **${exampleItem.qualityEmoji} ${exampleItem.name}**\n` +
        `🏷️ ID: \`${exampleItem.id}\`\n` +
        `🔓 Level: **Lv.${exampleItem.requiredLevel || 1}**\n` +
        `📊 Stats: ${formatItemStats(exampleItem)}`
    );
  }

  return message.reply(
    "❌ Unknown item admin command.\n\n" +
      "Available:\n" +
      "`!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>`\n" +
      "`!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>`"
  );
};