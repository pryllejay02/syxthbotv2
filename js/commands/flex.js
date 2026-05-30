const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const tradeConfig = require("../data/tradeConfig");
const { getQualityEmoji } = require("../utils/qualitySystem");

const EQUIPMENT_SLOTS = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "pants",
  "boots",
];

function formatClass(classes = []) {
  if (!Array.isArray(classes)) return "All";

  return classes
    .map((cls) => {
      const text = String(cls || "all");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(", ");
}

function formatStats(stats = {}) {
  const parts = [];

  if (stats.attack) parts.push(`⚔️ ATK: ${stats.attack}`);
  if (stats.defense) parts.push(`🛡️ DEF: ${stats.defense}`);
  if (stats.maxHp) parts.push(`❤️ HP: ${stats.maxHp}`);
  if (stats.dodge) parts.push(`💨 Dodge: ${stats.dodge}%`);
  if (stats.crit) parts.push(`💥 Crit: ${stats.crit}%`);

  return parts.length ? parts.join("\n") : "No bonus stats";
}

function getItemColor(item) {
  const quality = String(item.quality || "Common").toLowerCase();

  if (quality === "legendary") return "#F59E0B";
  if (quality === "rare") return "#3B82F6";
  if (quality === "common") return "#22C55E";
  if (quality === "starter") return "#94A3B8";

  return "#8B0000";
}

function getItemEmoji(item) {
  if (item.emoji) return item.emoji;

  const type = String(item.type || "").toLowerCase();

  if (type === "weapon") return "🗡️";
  if (type === "helmet") return "⛑️";
  if (type === "armor") return "🦺";
  if (type === "gloves") return "🧤";
  if (type === "pants") return "👖";
  if (type === "boots") return "🥾";
  if (type === "consumable") return "🧪";

  return "📦";
}

function findInventoryItem(inventory = [], itemId) {
  return inventory.find(
    (item) =>
      item.id &&
      item.id.toLowerCase() === itemId.toLowerCase()
  );
}

function findEquippedItem(equipment = {}, input) {
  const normalized = String(input || "").toLowerCase();

  if (EQUIPMENT_SLOTS.includes(normalized)) {
    const item = equipment[normalized];

    if (!item) return null;

    return {
      item,
      slot: normalized,
    };
  }

  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];

    if (
      item &&
      item.id &&
      item.id.toLowerCase() === normalized
    ) {
      return {
        item,
        slot,
      };
    }
  }

  return null;
}

module.exports = async function flexCommand(message, args = []) {
  const userId = message.author.id;
  const itemId = args[0];

  if (message.channel.id !== tradeConfig.tradeAreaChannelId) {
    return message.reply(
      `❌ You can only flex items inside <#${tradeConfig.tradeAreaChannelId}>.`
    );
  }

  if (!itemId) {
    return message.reply(
      "❌ Please specify an item ID or equipped slot.\n\n" +
        "Examples:\n" +
        "`!s flex <item_id>`\n" +
        "`!s flex weapon`\n" +
        "`!s flex armor`"
    );
  }

  const playerRef = db.collection("players").doc(userId);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "❌ You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();
  const inventory = Array.isArray(player.inventory)
    ? player.inventory
    : [];
  const equipment = player.equipment || {};

  let item = findInventoryItem(inventory, itemId);
  let sourceText = "Inventory";
  let tradeWarning =
    "✅ This item can be added to trade if it is still in your inventory.";

  if (!item) {
    const equippedResult = findEquippedItem(equipment, itemId);

    if (equippedResult) {
      item = equippedResult.item;
      sourceText = `Equipped: ${equippedResult.slot}`;
      tradeWarning =
        "⚠️ This item is currently equipped. Unequip it first before trading.";
    }
  }

  if (!item) {
    return message.reply(
      "❌ You don’t have that item in your inventory or equipment."
    );
  }

  const quality = item.quality || "Common";
  const qualityEmoji =
    quality === "Starter" ? "🌱" : getQualityEmoji(quality);

  const quantity = Number(item.quantity || 1);
  const itemEmoji = getItemEmoji(item);

  const embed = new EmbedBuilder()
    .setColor(getItemColor(item))
    .setTitle("💎 SYXTH ITEM FLEX")
    .setDescription(
      `👤 **${player.username || message.author.username}** is showing an item:\n\n` +
        `${itemEmoji} ${qualityEmoji} **${item.name || "Unknown Item"}**\n\n` +
        `━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: "🏷️ Item Info",
        value:
          `**ID:** \`${item.id || "no-id"}\`\n` +
          `**Type:** ${item.type || "Unknown"}\n` +
          `**Quality:** ${qualityEmoji} ${quality}\n` +
          `**Quantity:** ${quantity}\n` +
          `**Source:** ${sourceText}`,
        inline: true,
      },
      {
        name: "🔓 Requirements",
        value:
          `**Required Level:** Lv.${item.requiredLevel || 1}\n` +
          `**Class:** ${formatClass(item.compatibleClasses || ["all"])}\n` +
          `**Price Value:** ${item.price || 0} Gold`,
        inline: true,
      },
      {
        name: "📊 Bonus Stats",
        value: formatStats(item.stats || {}),
        inline: false,
      },
      {
        name: "🤝 Trade Note",
        value:
          `${tradeWarning}\n\n` +
          `To start a secure trade, use the private trade creation channel.`,
        inline: false,
      }
    )
    .setThumbnail(
      message.author.displayAvatarURL({
        dynamic: true,
      })
    )
    .setFooter({
      text: "Syxth MMORPG Trading Area",
    })
    .setTimestamp();

  return message.channel.send({
    embeds: [embed],
  });
};