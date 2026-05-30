const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("./qualitySystem");

const ACTIVE_TRADE_STATUSES = ["pending", "active", "processing"];

function getMentionedUser(message) {
  return [...message.mentions.users.values()].find(
    (user) => !user.bot && user.id !== message.author.id
  );
}

async function getPlayer(userId) {
  if (!userId) return null;

  const doc = await db.collection("players").doc(userId).get();

  if (!doc.exists) return null;

  return {
    id: doc.id,
    ...doc.data(),
  };
}

function isUserInTrade(trade, userId) {
  return trade.player1Id === userId || trade.player2Id === userId;
}

async function findActiveTrade(userId) {
  if (!userId) return null;

  const snapshot = await db
    .collection("trades")
    .where("status", "in", ACTIVE_TRADE_STATUSES)
    .get();

  for (const doc of snapshot.docs) {
    const trade = doc.data();

    if (isUserInTrade(trade, userId)) {
      return {
        id: doc.id,
        ...trade,
      };
    }
  }

  return null;
}

function isStarterItem(item) {
  if (!item) return false;

  return (
    item.quality === "Starter" ||
    item.source === "starter" ||
    item.isStarter === true
  );
}

function findInventoryItem(player, itemId) {
  if (!player || !itemId) return null;

  const inventory = player.inventory || [];

  return inventory.find(
    (item) =>
      item.id &&
      item.id.toLowerCase() === String(itemId).toLowerCase()
  );
}

function formatClass(classes = []) {
  if (!Array.isArray(classes)) return "All";

  return classes
    .map((cls) => {
      const text = String(cls || "all");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(", ");
}

function formatItemStats(item = {}) {
  const stats = item.stats || {};
  const parts = [];

  if (stats.attack) parts.push(`⚔️ +${stats.attack}`);
  if (stats.defense) parts.push(`🛡️ +${stats.defense}`);
  if (stats.maxHp) parts.push(`❤️ +${stats.maxHp}`);
  if (stats.dodge) parts.push(`💨 +${stats.dodge}%`);
  if (stats.crit) parts.push(`💥 +${stats.crit}%`);

  return parts.length ? parts.join(" • ") : "No bonus stats";
}

function formatTradeItem(item) {
  if (!item) return "Unknown item";

  const quality = item.quality || "Common";
  const qualityEmoji =
    quality === "Starter" ? "🌱" : getQualityEmoji(quality);

  const quantity = Number(item.quantity || 1);

  return (
    `${item.emoji || "📦"} **${item.name || "Unknown Item"}** x${quantity}\n` +
    `└ ${qualityEmoji} ${quality} • ${item.type || "Unknown"}\n` +
    `└ 🔓 Lv.${item.requiredLevel || 1}\n` +
    `└ 🎭 ${formatClass(item.compatibleClasses || ["all"])}\n` +
    `└ 📊 ${formatItemStats(item)}\n` +
    `└ 🏷️ \`${item.id || "no-id"}\``
  );
}

function formatTradeItems(items = []) {
  if (!items.length) return "No items offered.";

  return items
    .map((item, index) => {
      return `**${index + 1}.** ${formatTradeItem(item)}`;
    })
    .join("\n\n");
}

function formatConfirmStatus(value) {
  return value ? "✅ Confirmed" : "⏳ Waiting";
}

function getTradeExpiryText(trade) {
  if (!trade.expiresAt) return "";

  const remainingMs = Number(trade.expiresAt || 0) - Date.now();
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  if (remainingSeconds <= 0) return "Expired";

  return `${remainingSeconds}s remaining`;
}

function formatTradeWindow(trade) {
  const player1Items = trade.player1Items || [];
  const player2Items = trade.player2Items || [];

  const player1Gold = Number(trade.player1Gold || 0);
  const player2Gold = Number(trade.player2Gold || 0);

  const expiryText =
    trade.status === "pending"
      ? `\n⏳ Invite Expiry: **${getTradeExpiryText(trade)}**`
      : "";

  return (
    `🤝 **SYXTH TRADE WINDOW**\n\n` +
    `Trade ID: \`${trade.id || trade.tradeId || "unknown"}\`\n` +
    `Status: **${trade.status || "unknown"}**${expiryText}\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +

    `👤 **Player 1:** <@${trade.player1Id}>\n` +
    `Confirmation: **${formatConfirmStatus(trade.player1Confirmed)}**\n` +
    `Gold Offer: **${player1Gold} Gold**\n\n` +
    `🎒 **Items Offered:**\n` +
    `${formatTradeItems(player1Items)}\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +

    `👤 **Player 2:** <@${trade.player2Id}>\n` +
    `Confirmation: **${formatConfirmStatus(trade.player2Confirmed)}**\n` +
    `Gold Offer: **${player2Gold} Gold**\n\n` +
    `🎒 **Items Offered:**\n` +
    `${formatTradeItems(player2Items)}\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +
    `Commands:\n` +
    `\`!s trade add <item_id> <qty>\`\n` +
    `\`!s trade remove <item_id>\`\n` +
    `\`!s trade gold <amount>\`\n` +
    `\`!s trade confirm\`\n` +
    `\`!s trade cancel\`\n` +
    `\`!s trade status\``
  );
}

module.exports = {
  ACTIVE_TRADE_STATUSES,
  getMentionedUser,
  getPlayer,
  isUserInTrade,
  findActiveTrade,
  isStarterItem,
  findInventoryItem,
  formatTradeItem,
  formatTradeItems,
  formatTradeWindow,
};