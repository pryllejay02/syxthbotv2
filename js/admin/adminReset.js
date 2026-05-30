const { db } = require("../../firebase/firebase");

function getMention(message) {
  return message.mentions.users.first();
}

async function safeDeleteChannel(guild, channelId) {
  if (!channelId) return false;

  const channel = await guild.channels
    .fetch(channelId)
    .catch(() => null);

  if (!channel) return false;

  await channel.delete().catch(() => null);

  return true;
}

async function resetTradeForUser(message, userId) {
  const snapshot = await db
    .collection("trades")
    .where("status", "in", ["pending", "active", "processing"])
    .get();

  let tradeCount = 0;
  let channelCount = 0;

  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const trade = doc.data();

    const isInTrade =
      trade.player1Id === userId ||
      trade.player2Id === userId;

    if (!isInTrade) continue;

    if (trade.channelId) {
      const deleted = await safeDeleteChannel(
        message.guild,
        trade.channelId
      );

      if (deleted) channelCount++;
    }

    batch.delete(doc.ref);
    tradeCount++;
  }

  if (tradeCount > 0) {
    await batch.commit();
  }

  return {
    tradeCount,
    channelCount,
  };
}

async function resetPartyForUser(message, userId) {
  const snapshot = await db
    .collection("parties")
    .where("status", "in", ["forming", "ready", "raiding"])
    .get();

  let partyCount = 0;
  let channelCount = 0;

  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const party = doc.data();

    const members = party.members || [];
    const invited = party.invited || [];

    const isInParty =
      party.leaderId === userId ||
      members.includes(userId) ||
      invited.includes(userId);

    if (!isInParty) continue;

    if (party.voiceChannelId) {
      const deleted = await safeDeleteChannel(
        message.guild,
        party.voiceChannelId
      );

      if (deleted) channelCount++;
    }

    batch.delete(doc.ref);
    partyCount++;
  }

  if (partyCount > 0) {
    await batch.commit();
  }

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
        `🔊 Voice Channels Deleted: **${result.channelCount}**`
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
        `🔊 Party Voice Channels Deleted: **${result.partyResult.channelCount}**\n` +
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