const { db } = require("../../firebase/firebase");
const { deleteTradeChannel } = require("./tradeService");
const tradeConfig = require("../data/tradeConfig");

const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
const ACTIVE_TRADE_STALE_MS = 60 * 60 * 1000; // 1 hour

let cleanupTimer = null;

async function cleanupExpiredPendingTrades(client) {
  const now = Date.now();

  const snapshot = await db
    .collection("trades")
    .where("status", "==", "pending")
    .get();

  let deletedCount = 0;

  for (const doc of snapshot.docs) {
    const trade = doc.data();
    const expiresAt = Number(trade.expiresAt || 0);

    if (!expiresAt || now < expiresAt) continue;

    await doc.ref.delete().catch(() => null);
    deletedCount++;
  }

  return deletedCount;
}

async function cleanupStaleActiveTrades(client) {
  const now = Date.now();

  const snapshot = await db
    .collection("trades")
    .where("status", "in", ["active", "processing"])
    .get();

  let deletedCount = 0;
  let channelDeletedCount = 0;

  for (const doc of snapshot.docs) {
    const trade = doc.data();

    const updatedAt =
      trade.updatedAt?.toMillis?.() ||
      trade.createdAt?.toMillis?.() ||
      0;

    if (!updatedAt) continue;

    const age = now - updatedAt;

    if (age < ACTIVE_TRADE_STALE_MS) continue;

    if (trade.channelId) {
      const guilds = [...client.guilds.cache.values()];

      for (const guild of guilds) {
        const deleted = await deleteTradeChannel(guild, trade.channelId);

        if (deleted) {
          channelDeletedCount++;
          break;
        }
      }
    }

    await doc.ref.delete().catch(() => null);
    deletedCount++;
  }

  return {
    deletedCount,
    channelDeletedCount,
  };
}

async function cleanupTrades(client) {
  try {
    const expiredPending = await cleanupExpiredPendingTrades(client);
    const staleActive = await cleanupStaleActiveTrades(client);

    if (
      expiredPending > 0 ||
      staleActive.deletedCount > 0 ||
      staleActive.channelDeletedCount > 0
    ) {
      console.log(
        `[Trade Cleanup] Pending deleted: ${expiredPending}, ` +
          `Active deleted: ${staleActive.deletedCount}, ` +
          `Channels deleted: ${staleActive.channelDeletedCount}`
      );
    }
  } catch (error) {
    console.error("[Trade Cleanup Error]:", error);
  }
}

function startTradeCleanup(client) {
  if (cleanupTimer) return cleanupTimer;

  cleanupTrades(client);

  cleanupTimer = setInterval(() => {
    cleanupTrades(client);
  }, CLEANUP_INTERVAL_MS);

  cleanupTimer.unref?.();

  console.log("[Trade Cleanup] Service started.");

  return cleanupTimer;
}

function stopTradeCleanup() {
  if (!cleanupTimer) return;

  clearInterval(cleanupTimer);
  cleanupTimer = null;

  console.log("[Trade Cleanup] Service stopped.");
}

module.exports = {
  cleanupTrades,
  startTradeCleanup,
  stopTradeCleanup,
};