const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("./qualitySystem");

const {
  normalizeTradePets,
  formatTradePets,
} = require("./petSystem");

const ACTIVE_TRADE_STATUSES = ["pending", "active", "processing"];

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function getMentionedUser(message) {
  if (!message?.mentions?.users) return null;

  return [...message.mentions.users.values()].find(
    (user) => user && !user.bot && user.id !== message.author.id
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

function isUserInTrade(trade = {}, userId) {
  if (!trade || !userId) return false;

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

  const inventory = getArray(player.inventory);
  const targetId = normalizeId(itemId);

  return inventory.find((item) => {
    if (!item) return false;

    const id = normalizeId(item.id);
    const baseItemId = normalizeId(item.baseItemId);

    return id === targetId || baseItemId === targetId;
  });
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

function getQualityDisplay(item = {}) {
  const quality = item.quality || "Common";

  if (quality === "Starter") {
    return {
      quality,
      qualityEmoji: "🌱",
    };
  }

  return {
    quality,
    qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),
  };
}

function formatTradeItem(item) {
  if (!item) return "Unknown item";

  const { quality, qualityEmoji } = getQualityDisplay(item);
  const quantity = Number(item.quantity || 1);
  const baseItemId = item.baseItemId || item.id || "no-base-id";

  return (
    `${item.emoji || "📦"} **${item.name || "Unknown Item"}** x${quantity}\n` +
    `└ ${qualityEmoji} ${quality} • ${item.type || "Unknown"}\n` +
    `└ 🔓 Lv.${item.requiredLevel || 1}\n` +
    `└ 🎭 ${formatClass(item.compatibleClasses || ["all"])}\n` +
    `└ 📊 ${formatItemStats(item)}\n` +
    `└ 🏷️ ID: \`${item.id || "no-id"}\`\n` +
    `└ 🧬 Base ID: \`${baseItemId}\``
  );
}

function formatTradeItems(items = []) {
  const safeItems = getArray(items);

  if (!safeItems.length) return "No items offered.";

  return safeItems
    .map((item, index) => {
      return `**${index + 1}.** ${formatTradeItem(item)}`;
    })
    .join("\n\n");
}

function formatConfirmStatus(value) {
  return value ? "✅ Confirmed" : "⏳ Waiting";
}

function getTradeExpiryText(trade = {}) {
  if (!trade.expiresAt) return "No expiry";

  const remainingMs = Number(trade.expiresAt || 0) - Date.now();
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  if (remainingSeconds <= 0) return "Expired";

  if (remainingSeconds < 60) {
    return `${remainingSeconds}s remaining`;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  if (seconds === 0) {
    return `${minutes}m remaining`;
  }

  return `${minutes}m ${seconds}s remaining`;
}

function getTradeStatusText(trade = {}) {
  const status = String(trade.status || "unknown").toLowerCase();

  if (status === "pending") return "Pending Invite";
  if (status === "active") return "Active";
  if (status === "processing") return "Processing";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "declined") return "Declined";

  return status;
}

function formatPlayerTradeSection({
  label = "Player",
  userId = "unknown",
  confirmed = false,
  gold = 0,
  items = [],
  pets = [],
}) {
  const safePets = normalizeTradePets(pets || []);

  return (
    `👤 **${label}:** <@${userId || "unknown"}>\n` +
    `Confirmation: **${formatConfirmStatus(confirmed)}**\n` +
    `Gold Offer: **${Number(gold || 0)} Gold**\n\n` +

    `🎒 **Items Offered:**\n` +
    `${formatTradeItems(items)}\n\n` +

    `🐾 **Pets Offered:**\n` +
    `${formatTradePets(safePets)}`
  );
}

function formatTradeWindow(trade = {}) {
  const player1Items = getArray(trade.player1Items);
  const player2Items = getArray(trade.player2Items);

  const player1Pets = normalizeTradePets(trade.player1Pets || []);
  const player2Pets = normalizeTradePets(trade.player2Pets || []);

  const player1Gold = Number(trade.player1Gold || 0);
  const player2Gold = Number(trade.player2Gold || 0);

  const expiryText =
    trade.status === "pending"
      ? `\n⏳ Invite Expiry: **${getTradeExpiryText(trade)}**`
      : "";

  return (
    `🤝 **SYXTH TRADE WINDOW**\n\n` +
    `Trade ID: \`${trade.id || trade.tradeId || "unknown"}\`\n` +
    `Status: **${getTradeStatusText(trade)}**${expiryText}\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +

    formatPlayerTradeSection({
      label: "Player 1",
      userId: trade.player1Id,
      confirmed: trade.player1Confirmed,
      gold: player1Gold,
      items: player1Items,
      pets: player1Pets,
    }) +

    `\n\n━━━━━━━━━━━━━━━━━━\n\n` +

    formatPlayerTradeSection({
      label: "Player 2",
      userId: trade.player2Id,
      confirmed: trade.player2Confirmed,
      gold: player2Gold,
      items: player2Items,
      pets: player2Pets,
    }) +

    `\n\n━━━━━━━━━━━━━━━━━━\n\n` +
    `Commands:\n` +
    `\`!s trade add <item_id> <qty>\`\n` +
    `\`!s trade remove <item_id>\`\n` +
    `\`!s trade addpet <pet_id>\`\n` +
    `\`!s trade removepet <pet_id>\`\n` +
    `\`!s trade gold <amount>\`\n` +
    `\`!s trade confirm\`\n` +
    `\`!s trade cancel\`\n` +
    `\`!s trade status\``
  );
}

module.exports = {
  ACTIVE_TRADE_STATUSES,

  normalizeId,
  getArray,

  getMentionedUser,
  getPlayer,

  isUserInTrade,
  findActiveTrade,

  isStarterItem,
  findInventoryItem,

  formatClass,
  formatItemStats,
  getQualityDisplay,

  formatTradeItem,
  formatTradeItems,
  formatTradeWindow,
};