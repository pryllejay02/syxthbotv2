const { db } = require("../../firebase/firebase");

function getMention(message) {
  return message.mentions.users.first();
}

async function resetTradeForUser(message, userId) {
  const snapshot = await db
    .collection("trades")
    .where("status", "in", ["pending", "active", "processing"])
    .get();

  let count = 0;

  for (const doc of snapshot.docs) {
    const trade = doc.data();

    if (trade.player1Id === userId || trade.player2Id === userId) {
      if (trade.channelId) {
        const channel = await message.guild.channels
          .fetch(trade.channelId)
          .catch(() => null);

        if (channel) await channel.delete().catch(() => null);
      }

      await doc.ref.delete();
      count++;
    }
  }

  return count;
}

async function resetPartyForUser(message, userId) {
  const snapshot = await db
    .collection("parties")
    .where("status", "in", ["forming", "ready", "raiding"])
    .get();

  let count = 0;

  for (const doc of snapshot.docs) {
    const party = doc.data();
    const members = party.members || [];
    const invited = party.invited || [];

    if (
      party.leaderId === userId ||
      members.includes(userId) ||
      invited.includes(userId)
    ) {
      if (party.voiceChannelId) {
        const channel = await message.guild.channels
          .fetch(party.voiceChannelId)
          .catch(() => null);

        if (channel) await channel.delete().catch(() => null);
      }

      await doc.ref.delete();
      count++;
    }
  }

  return count;
}

module.exports = async function adminReset(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (!target || target.bot) {
    return message.reply("❌ Please mention a valid player.");
  }

  if (subCommand === "resettrade") {
    const count = await resetTradeForUser(message, target.id);

    return message.reply(`✅ Reset **${count}** trade(s) for ${target.username}.`);
  }

  if (subCommand === "resetparty") {
    const count = await resetPartyForUser(message, target.id);

    return message.reply(`✅ Reset **${count}** party record(s) for ${target.username}.`);
  }

  return message.reply("❌ Unknown reset admin command.");
};