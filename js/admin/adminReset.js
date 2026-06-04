const { db } = require("../../firebase/firebase");

const ACTIVE_TRADE_STATUSES = ["pending", "active", "processing"];
const ACTIVE_PARTY_STATUSES = ["forming", "ready", "raiding"];

function getMention(message) {
  return message.mentions.users.first();
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueIds(ids = []) {
  return [...new Set(ids.filter(Boolean))];
}

async function safeDeleteChannel(guild, channelId, reason = "Admin reset cleanup.") {
  if (!guild || !channelId) return false;

  const channel = await guild.channels
    .fetch(channelId)
    .catch(() => null);

  if (!channel) return false;

  const deleted = await channel
    .delete(reason)
    .then(() => true)
    .catch((error) => {
      console.error("[Admin Reset] Failed to delete channel:", error);
      return false;
    });

  return deleted;
}

async function commitBatchIfNeeded(batch, count) {
  if (count > 0) {
    await batch.commit();
  }
}

function isUserInTrade(trade = {}, userId) {
  if (!userId) return false;

  return (
    trade.player1Id === userId ||
    trade.player2Id === userId ||
    trade.senderId === userId ||
    trade.receiverId === userId ||
    trade.fromUserId === userId ||
    trade.toUserId === userId
  );
}

function isUserInParty(party = {}, userId) {
  if (!userId) return false;

  const members = getArray(party.members);
  const invited = getArray(party.invited);
  const pendingInvites = getArray(party.pendingInvites);

  return (
    party.leaderId === userId ||
    party.hostId === userId ||
    members.includes(userId) ||
    invited.includes(userId) ||
    pendingInvites.includes(userId)
  );
}

async function resetTradeForUser(message, userId) {
  const snapshot = await db
    .collection("trades")
    .where("status", "in", ACTIVE_TRADE_STATUSES)
    .get();

  let tradeCount = 0;
  let channelCount = 0;

  const deletedChannelIds = new Set();
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const trade = doc.data();

    if (!isUserInTrade(trade, userId)) continue;

    if (trade.channelId && !deletedChannelIds.has(trade.channelId)) {
      const deleted = await safeDeleteChannel(
        message.guild,
        trade.channelId,
        "Syxth MMORPG trade reset cleanup."
      );

      deletedChannelIds.add(trade.channelId);

      if (deleted) {
        channelCount++;
      }
    }

    batch.delete(doc.ref);
    tradeCount++;
  }

  await commitBatchIfNeeded(batch, tradeCount);

  return {
    tradeCount,
    channelCount,
  };
}

async function resetPartyForUser(message, userId) {
  const snapshot = await db
    .collection("parties")
    .where("status", "in", ACTIVE_PARTY_STATUSES)
    .get();

  let partyCount = 0;
  let channelCount = 0;

  const deletedChannelIds = new Set();
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const party = doc.data();

    if (!isUserInParty(party, userId)) continue;

    const channelIds = uniqueIds([
      party.voiceChannelId,
      party.textChannelId,
      party.channelId,
    ]);

    for (const channelId of channelIds) {
      if (deletedChannelIds.has(channelId)) continue;

      const deleted = await safeDeleteChannel(
        message.guild,
        channelId,
        "Syxth MMORPG party reset cleanup."
      );

      deletedChannelIds.add(channelId);

      if (deleted) {
        channelCount++;
      }
    }

    batch.delete(doc.ref);
    partyCount++;
  }

  await commitBatchIfNeeded(batch, partyCount);

  return {
    partyCount,
    channelCount,
  };
}

async function resetBattleForUser(userId) {
  const battleRef = db.collection("battles").doc(userId);
  const battleDoc = await battleRef.get();

  if (!battleDoc.exists) {
    return {
      battleDeleted: false,
    };
  }

  await battleRef.delete();

  return {
    battleDeleted: true,
  };
}

async function resetAllForUser(message, userId) {
  const tradeResult = await resetTradeForUser(message, userId);
  const partyResult = await resetPartyForUser(message, userId);
  const battleResult = await resetBattleForUser(userId);

  return {
    tradeResult,
    partyResult,
    battleResult,
  };
}

module.exports = async function adminReset(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (!target || target.bot) {
    return message.reply("❌ Please mention a valid player.");
  }

  if (subCommand === "resettrade") {
    const result = await resetTradeForUser(message, target.id);

    return message.reply(
      `✅ Reset trade records for **${target.username}**.\n\n` +
        `🤝 Trades Deleted: **${result.tradeCount}**\n` +
        `🧹 Trade Channels Deleted: **${result.channelCount}**`
    );
  }

  if (subCommand === "resetparty") {
    const result = await resetPartyForUser(message, target.id);

    return message.reply(
      `✅ Reset party records for **${target.username}**.\n\n` +
        `👥 Parties Deleted: **${result.partyCount}**\n` +
        `🧹 Party Channels Deleted: **${result.channelCount}**`
    );
  }

  if (subCommand === "resetbattle") {
    const result = await resetBattleForUser(target.id);

    return message.reply(
      result.battleDeleted
        ? `✅ Active battle reset for **${target.username}**.`
        : `ℹ️ **${target.username}** has no active battle.`
    );
  }

  if (subCommand === "resetall") {
    const result = await resetAllForUser(message, target.id);

    return message.reply(
      `✅ Full reset completed for **${target.username}**.\n\n` +
        `🤝 Trades Deleted: **${result.tradeResult.tradeCount}**\n` +
        `🧹 Trade Channels Deleted: **${result.tradeResult.channelCount}**\n` +
        `👥 Parties Deleted: **${result.partyResult.partyCount}**\n` +
        `🧹 Party Channels Deleted: **${result.partyResult.channelCount}**\n` +
        `⚔️ Battle Deleted: **${
          result.battleResult.battleDeleted ? "Yes" : "No"
        }**`
    );
  }

  return message.reply(
    "❌ Unknown reset admin command.\n\n" +
      "Available:\n" +
      "`!s admin resettrade @player`\n" +
      "`!s admin resetparty @player`\n" +
      "`!s admin resetbattle @player`\n" +
      "`!s admin resetall @player`"
  );
};