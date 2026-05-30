const { db } = require("../../firebase/firebase");

const {
  safeDeletePartyVoiceChannel,
} = require("./partyService");

const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
const EMPTY_PARTY_STALE_MS = 10 * 60 * 1000; // 10 minutes
const ACTIVE_PARTY_STATUSES = ["forming", "ready", "raiding"];

let cleanupTimer = null;

function getTimestampMillis(value) {
  if (!value) return 0;

  if (typeof value === "number") return value;

  if (value.toMillis) {
    return value.toMillis();
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

function getNonBotMembers(channel) {
  if (!channel) return [];

  return [...channel.members.values()].filter(
    (member) => !member.user.bot
  );
}

async function findGuildChannel(client, channelId) {
  if (!client || !channelId) return null;

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

async function cleanupParties(client) {
  try {
    const snapshot = await db
      .collection("parties")
      .where("status", "in", ACTIVE_PARTY_STATUSES)
      .get();

    let deletedParties = 0;
    let deletedChannels = 0;

    const now = Date.now();

    for (const doc of snapshot.docs) {
      const party = {
        id: doc.id,
        ...doc.data(),
      };

      const createdAt = getTimestampMillis(party.createdAt);
      const updatedAt = getTimestampMillis(party.updatedAt) || createdAt;
      const age = now - updatedAt;

      const members = party.members || [];
      const invited = party.invited || [];

      const hasNoMembers = members.length === 0;
      const hasNoVoiceChannel = !party.voiceChannelId;

      if (hasNoMembers || hasNoVoiceChannel) {
        await doc.ref.delete().catch(() => null);
        deletedParties++;
        continue;
      }

      const found = await findGuildChannel(client, party.voiceChannelId);

      if (!found) {
        await doc.ref.delete().catch(() => null);
        deletedParties++;
        continue;
      }

      const nonBotMembers = getNonBotMembers(found.channel);

      const isEmptyTooLong =
        nonBotMembers.length === 0 &&
        age >= EMPTY_PARTY_STALE_MS;

      const noPendingActivity =
        members.length <= 1 &&
        invited.length === 0 &&
        nonBotMembers.length === 0 &&
        age >= EMPTY_PARTY_STALE_MS;

      if (isEmptyTooLong || noPendingActivity) {
        const deleted = await safeDeletePartyVoiceChannel(
          found.guild,
          party.voiceChannelId
        );

        if (deleted) deletedChannels++;

        await doc.ref.delete().catch(() => null);
        deletedParties++;
      }
    }

    if (deletedParties > 0 || deletedChannels > 0) {
      console.log(
        `[Party Cleanup] Parties deleted: ${deletedParties}, Channels deleted: ${deletedChannels}`
      );
    }
  } catch (error) {
    console.error("[Party Cleanup Error]:", error);
  }
}

function startPartyCleanup(client) {
  if (cleanupTimer) return cleanupTimer;

  cleanupParties(client);

  cleanupTimer = setInterval(() => {
    cleanupParties(client);
  }, CLEANUP_INTERVAL_MS);

  cleanupTimer.unref?.();

  console.log("[Party Cleanup] Service started.");

  return cleanupTimer;
}

function stopPartyCleanup() {
  if (!cleanupTimer) return;

  clearInterval(cleanupTimer);
  cleanupTimer = null;

  console.log("[Party Cleanup] Service stopped.");
}

module.exports = {
  cleanupParties,
  startPartyCleanup,
  stopPartyCleanup,
};