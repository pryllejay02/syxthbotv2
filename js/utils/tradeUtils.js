const { db } = require("../../firebase/firebase");

function getMentionedUser(message) {
  return message.mentions.users.first();
}

async function getPlayer(userId) {
  const doc = await db.collection("players").doc(userId).get();
  if (!doc.exists) return null;

  return {
    id: doc.id,
    ...doc.data(),
  };
}

async function findActiveTrade(userId) {
  const snapshot = await db
    .collection("trades")
    .where("status", "in", ["pending", "active"])
    .get();

  for (const doc of snapshot.docs) {
    const trade = doc.data();

    if (trade.player1Id === userId || trade.player2Id === userId) {
      return {
        id: doc.id,
        ...trade,
      };
    }
  }

  return null;
}

function isStarterItem(item) {
  return item.quality === "Starter" || item.source === "starter";
}

function findInventoryItem(player, itemId) {
  const inventory = player.inventory || [];

  return inventory.find(
    (item) => item.id.toLowerCase() === itemId.toLowerCase()
  );
}

function formatTradeItems(items = []) {
  if (!items.length) return "None";

  return items
    .map((item) => {
      return (
        `${item.qualityEmoji || ""} **${item.name || "Unknown Item"}** x${item.quantity || 1}\n` +
        `└ 🔓 Lv.${item.requiredLevel || 1}\n` +
        `└ 🎭 ${(item.compatibleClasses || ["all"]).join(", ")}\n` +
        `└ ⚔️ ATK: ${item.stats?.attack || 0} | 🛡️ DEF: ${item.stats?.defense || 0} | ❤️ HP: ${item.stats?.maxHp || 0}\n` +
        `└ 💨 Dodge: ${item.stats?.dodge || 0}% | 💥 Crit: ${item.stats?.crit || 0}%\n` +
        `└ 🏷️ \`${item.id}\``
      );
    })
    .join("\n\n");
}

function formatTradeWindow(trade) {
  return (
    `🤝 **SYXTH PRIVATE TRADE**\n\n` +
    `👤 <@${trade.player1Id}>\n` +
    `🪙 Gold: ${trade.player1Gold || 0}\n` +
    `🎒 Items:\n${formatTradeItems(trade.player1Items)}\n` +
    `Status: ${trade.player1Confirmed ? "✅ Confirmed" : "❌ Waiting"}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 <@${trade.player2Id}>\n` +
    `🪙 Gold: ${trade.player2Gold || 0}\n` +
    `🎒 Items:\n${formatTradeItems(trade.player2Items)}\n` +
    `Status: ${trade.player2Confirmed ? "✅ Confirmed" : "❌ Waiting"}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `\`!s trade add <item_id> <qty>\`\n` +
    `\`!s trade remove <item_id>\`\n` +
    `\`!s trade gold <amount>\`\n` +
    `\`!s trade confirm\`\n` +
    `\`!s trade cancel\``
  );
}

module.exports = {
  getMentionedUser,
  getPlayer,
  findActiveTrade,
  isStarterItem,
  findInventoryItem,
  formatTradeItems,
  formatTradeWindow,
};