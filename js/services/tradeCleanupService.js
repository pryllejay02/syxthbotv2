const { db } = require("../../firebase/firebase");
const { deleteTradeChannel } = require("./tradeService");
const tradeConfig = require("../data/tradeConfig");

const CLEANUP_INTERVAL_MS = Number(
  process.env.TRADE_CLEANUP_INTERVAL_MS || 60 * 1000
);

const ACTIVE_TRADE_STALE_MS = Number(
  process.env.ACTIVE_TRADE_STALE_MS || 60 * 60 * 1000
);

const ACTIVE_TRADE_STATUSES = ["active", "processing"];

let cleanupTimer = null;

function getTimestampMillis(value) {
  if (!value) return 0;

  if (typeof value === "number") {
    return value;
  }

  if (value.toMillis) {
    return value.toMillis();
  }

  if (value.toDate) {
    return value.toDate().getTime();
  }

  const parsedNumber = Number(value);

  if (!Number.isNaN(parsedNumber)) {
    return parsedNumber;
  }

  const parsedDate = new Date(value).getTime();

  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

function getInviteExpireMs() {
  return Number(tradeConfig.inviteExpireMs || 2 * 60 * 1000);
}

function isClientReady(client) {
  return !!client?.guilds?.cache;
}

async function deleteTradeDocument(docRef) {
  await docRef.delete().catch((error) => {
    console.error("[Trade Cleanup] Failed to delete trade document:", error);
  });
}

async function findGuildChannel(client, channelId) {
  if (!isClientReady(client) || !channelId) return null;

  for (const guild of client.guilds.cache.values()) {
    const channel = await guild.channels
      .fetch(channelId)
      .catch(() => null);

    if (channel) {
      return {
        guild,
        channel,
      };
    }
  }

  return null;
}

async function deleteTradeChannelFromAnyGuild(client, channelId) {
  if (!isClientReady(client) || !channelId) return false;

  for (const guild of client.guilds.cache.values()) {
    const deleted = await deleteTradeChannel(guild, channelId).catch(
      (error) => {
        console.error("[Trade Cleanup] Failed to delete trade channel:", error);
        return false;
      }
    );

    if (deleted) {
      return true;
    }
  }

  return false;
}

async function cleanupExpiredPendingTrades() {
  const now = Date.now();

  const snapshot = await db
    .collection("trades")
    .where("status", "==", "pending")
    .get();

  let deletedCount = 0;

  for (const doc of snapshot.docs) {
    const trade = doc.data();

    const createdAt = getTimestampMillis(trade.createdAt);
    const expiresAt =
      Number(trade.expiresAt || 0) ||
      (createdAt ? createdAt + getInviteExpireMs() : 0);

    if (!expiresAt) continue;
    if (now < expiresAt) continue;

    await deleteTradeDocument(doc.ref);
    deletedCount++;
  }

  return deletedCount;
}

async function cleanupStaleActiveTrades(client) {
  if (!isClientReady(client)) {
    return {
      deletedCount: 0,
      channelDeletedCount: 0,
      missingChannelCount: 0,
      skipped: true,
    };
  }

  const now = Date.now();

  const snapshot = await db
    .collection("trades")
    .where("status", "in", ACTIVE_TRADE_STATUSES)
    .get();

  let deletedCount = 0;
  let channelDeletedCount = 0;
  let missingChannelCount = 0;

  for (const doc of snapshot.docs) {
    const trade = {
      id: doc.id,
      ...doc.data(),
    };

    const updatedAt =
      getTimestampMillis(trade.updatedAt) ||
      getTimestampMillis(trade.createdAt);

    if (!updatedAt) continue;

    const age = now - updatedAt;

    if (age < ACTIVE_TRADE_STALE_MS) continue;

    if (trade.channelId) {
      const found = await findGuildChannel(client, trade.channelId);

      if (found) {
        const deleted = await deleteTradeChannel(
          found.guild,
          trade.channelId
        ).catch((error) => {
          console.error("[Trade Cleanup] Failed to delete stale trade channel:", error);
          return false;
        });

        if (deleted) {
          channelDeletedCount++;
        }
      } else {
        const deletedFromAnyGuild = await deleteTradeChannelFromAnyGuild(
          client,
          trade.channelId
        );

        if (deletedFromAnyGuild) {
          channelDeletedCount++;
        } else {
          missingChannelCount++;
        }
      }
    }

    await deleteTradeDocument(doc.ref);
    deletedCount++;
  }

  return {
    deletedCount,
    channelDeletedCount,
    missingChannelCount,
    skipped: false,
  };
}

async function cleanupOrphanTradeChannels(client) {
  if (!isClientReady(client)) {
    return {
      deletedCount: 0,
      skipped: true,
    };
  }

  const snapshot = await db
    .collection("trades")
    .where("status", "in", ACTIVE_TRADE_STATUSES)
    .get();

  let deletedCount = 0;

  for (const doc of snapshot.docs) {
    const trade = doc.data();

    if (!trade.channelId) continue;

    const found = await findGuildChannel(client, trade.channelId);

    if (found) continue;

    await doc.ref
      .update({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .catch((error) => {
        console.error("[Trade Cleanup] Failed to cancel orphan trade:", error);
      });

    deletedCount++;
  }

  return {
    deletedCount,
    skipped: false,
  };
}

async function cleanupTrades(client) {
  try {
    const expiredPending = await cleanupExpiredPendingTrades();
    const staleActive = await cleanupStaleActiveTrades(client);
    const orphanChannels = await cleanupOrphanTradeChannels(client);

    if (
      expiredPending > 0 ||
      staleActive.deletedCount > 0 ||
      staleActive.channelDeletedCount > 0 ||
      staleActive.missingChannelCount > 0 ||
      orphanChannels.deletedCount > 0
    ) {
      console.log(
        `[Trade Cleanup] Pending deleted: ${expiredPending}, ` +
          `Active deleted: ${staleActive.deletedCount}, ` +
          `Channels deleted: ${staleActive.channelDeletedCount}, ` +
          `Missing channels: ${staleActive.missingChannelCount}, ` +
          `Orphan trades cancelled: ${orphanChannels.deletedCount}`
      );
    }

    return {
      expiredPending,
      staleActive,
      orphanChannels,
    };
  } catch (error) {
    console.error("[Trade Cleanup Error]:", error);

    return {
      expiredPending: 0,
      staleActive: {
        deletedCount: 0,
        channelDeletedCount: 0,
        missingChannelCount: 0,
        skipped: true,
      },
      orphanChannels: {
        deletedCount: 0,
        skipped: true,
      },
      error,
    };
  }
}

function startTradeCleanup(client) {
  if (cleanupTimer) {
    console.log("[Trade Cleanup] Service already running.");
    return cleanupTimer;
  }

  cleanupTrades(client);

  cleanupTimer = setInterval(() => {
    cleanupTrades(client);
  }, CLEANUP_INTERVAL_MS);

  cleanupTimer.unref?.();

  console.log(
    `[Trade Cleanup] Service started. Interval: ${CLEANUP_INTERVAL_MS}ms`
  );

  return cleanupTimer;
}

function stopTradeCleanup() {
  if (!cleanupTimer) {
    return false;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;

  console.log("[Trade Cleanup] Service stopped.");

  return true;
}

module.exports = {
  cleanupTrades,
  startTradeCleanup,
  stopTradeCleanup,
};