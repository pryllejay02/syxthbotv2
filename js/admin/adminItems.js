const { db } = require("../../firebase/firebase");
const shopItems = require("../data/shopItems");
const bossConfig = require("../data/bossConfig");
const { getQualityEmoji } = require("../utils/qualitySystem");
const { generateBossDrop } = require("../utils/bossLootSystem");

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

  return parts.join(", ");
}

function generateAdminItem(baseItem, quality) {
  const stats = scaleStatsByQuality(baseItem.stats || {}, quality);
  const qualityEmoji = getQualityEmoji(quality);

  return {
    ...baseItem,
    id: `${baseItem.id}_${quality.toLowerCase()}_admin_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
    baseItemId: baseItem.id,
    name: baseItem.name.replace(/^Common /, `${quality} `),
    quality,
    qualityEmoji,
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

function addItemToInventory(inventory, item, quantity) {
  const existingIndex = inventory.findIndex(
    (invItem) =>
      invItem.baseItemId === item.baseItemId &&
      invItem.quality === item.quality &&
      JSON.stringify(invItem.stats) === JSON.stringify(item.stats)
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
    const found = bosses.find((boss) => boss.id.toLowerCase() === key);
    if (found) return found.level;
  }

  return null;
}

module.exports = async function adminItems(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (!target || target.bot) {
    return message.reply("❌ Please mention a valid player.");
  }

  const playerRef = db.collection("players").doc(target.id);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("❌ Character not found.");
  }

  const player = playerDoc.data();

  if (subCommand === "giveitem") {
    const itemId = args[2];
    const qualityInput = args[3] || "Common";
    const quantity = Number(args[4] || 1);

    if (!itemId || quantity <= 0) {
      return message.reply(
        "❌ Usage: `!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>`"
      );
    }

    const validQuality = ["Common", "Rare", "Legendary"].find(
      (q) => q.toLowerCase() === String(qualityInput).toLowerCase()
    );

    if (!validQuality) {
      return message.reply("❌ Quality must be `Common`, `Rare`, or `Legendary`.");
    }

    const baseItem = shopItems.find(
      (shopItem) => shopItem.id.toLowerCase() === itemId.toLowerCase()
    );

    if (!baseItem) {
      return message.reply("❌ Item not found in shopItems.");
    }

    const inventory = player.inventory || [];
    const givenItems = [];

    for (let i = 0; i < quantity; i++) {
      const item = generateAdminItem(baseItem, validQuality);
      addItemToInventory(inventory, item, 1);
      givenItems.push(item);
    }

    await playerRef.update({ inventory });

    return message.reply(
      `✅ Gave **${quantity}x ${validQuality} ${baseItem.name.replace(/^Common /, "")}** to ${target.username}.\n` +
        `🎁 Example Roll: **${givenItems[0].qualityEmoji} ${givenItems[0].name}**\n` +
        `📊 Stats: ⚔️ ${givenItems[0].stats?.attack || 0} | 🛡️ ${givenItems[0].stats?.defense || 0} | ❤️ ${givenItems[0].stats?.maxHp || 0} | 💨 ${givenItems[0].stats?.dodge || 0}% | 💥 ${givenItems[0].stats?.crit || 0}%`
    );
  }

  if (subCommand === "givebossitem") {
    const bossOrTier = args[2];
    const quality = args[3];
    const quantity = Number(args[4] || 1);

    if (!bossOrTier || !quality || quantity <= 0) {
      return message.reply(
        "❌ Usage: `!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>`"
      );
    }

    const validQuality = ["Rare", "Legendary"].find(
      (q) => q.toLowerCase() === String(quality).toLowerCase()
    );

    if (!validQuality) {
      return message.reply("❌ Quality must be `Rare` or `Legendary`.");
    }

    const bossLevel = getBossLevelByIdOrTier(bossOrTier);

    if (!bossLevel) {
      return message.reply("❌ Boss ID or tier not found.");
    }

    const inventory = player.inventory || [];
    const givenItems = [];

    for (let i = 0; i < quantity; i++) {
      const item = generateBossDrop(bossLevel, validQuality);

      if (!item) {
        return message.reply("❌ Failed to generate boss item. Check shop item levels.");
      }

      addItemToInventory(inventory, item, 1);
      givenItems.push(item);
    }

    await playerRef.update({ inventory });

    return message.reply(
      `✅ Gave **${quantity}x ${validQuality} boss item(s)** to ${target.username}.\n` +
        `🎁 Example: **${givenItems[0].qualityEmoji} ${givenItems[0].name}**`
    );
  }

  return message.reply("❌ Unknown item admin command.");
};