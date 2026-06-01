const { db } = require("../../firebase/firebase");

const {
  safeDeletePartyVoiceChannel,
} = require("./partyService");

const CLEANUP_INTERVAL_MS = Number(
  process.env.PARTY_CLEANUP_INTERVAL_MS || 60 * 1000
);

const EMPTY_PARTY_STALE_MS = Number(
  process.env.EMPTY_PARTY_STALE_MS || 10 * 60 * 1000
);

const ACTIVE_PARTY_STATUSES = ["forming", "ready", "raiding"];

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

function getNonBotMembers(channel) {
  if (!channel || !channel.members) return [];

  return [...channel.members.values()].filter(
    (member) => !member.user?.bot
  );
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
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

async function deletePartyDocument(docRef) {
  await docRef.delete().catch((error) => {
    console.error("[Party Cleanup] Failed to delete party document:", error);
  });
}

async function deletePartyChannel(guild, voiceChannelId) {
  if (!guild || !voiceChannelId) return false;

  const deleted = await safeDeletePartyVoiceChannel(
    guild,
    voiceChannelId
  ).catch((error) => {
    console.error("[Party Cleanup] Failed to delete party voice channel:", error);
    return false;
  });

  return !!deleted;
}

function shouldDeleteParty({
  party,
  members,
  invited,
  nonBotMembers,
  age,
}) {
  const hasNoMembers = members.length === 0;
  const hasNoVoiceChannel = !party.voiceChannelId;

  if (hasNoMembers) {
    return {
      deleteParty: true,
      deleteChannel: !!party.voiceChannelId,
      reason: "no members",
    };
  }

  if (hasNoVoiceChannel) {
    return {
      deleteParty: true,
      deleteChannel: false,
      reason: "missing voice channel ID",
    };
  }

  const isEmptyTooLong =
    nonBotMembers.length === 0 &&
    age >= EMPTY_PARTY_STALE_MS;

  if (isEmptyTooLong) {
    return {
      deleteParty: true,
      deleteChannel: true,
      reason: "voice channel empty too long",
    };
  }

  const noPendingActivity =
    members.length <= 1 &&
    invited.length === 0 &&
    nonBotMembers.length === 0 &&
    age >= EMPTY_PARTY_STALE_MS;

  if (noPendingActivity) {
    return {
      deleteParty: true,
      deleteChannel: true,
      reason: "no pending party activity",
    };
  }

  return {
    deleteParty: false,
    deleteChannel: false,
    reason: null,
  };
}

async function cleanupParties(client) {
  try {
    const snapshot = await db
      .collection("parties")
      .where("status", "in", ACTIVE_PARTY_STATUSES)
      .get();

    let deletedParties = 0;
    let deletedChannels = 0;
    let checkedParties = 0;

    const now = Date.now();

    for (const doc of snapshot.docs) {
      checkedParties++;

      const party = {
        id: doc.id,
        ...doc.data(),
      };

      const createdAt = getTimestampMillis(party.createdAt);
      const updatedAt = getTimestampMillis(party.updatedAt) || createdAt;
      const age = now - updatedAt;

      const members = getArray(party.members);
      const invited = getArray(party.invited);

      if (!party.voiceChannelId) {
        await deletePartyDocument(doc.ref);
        deletedParties++;

        console.log(
          `[Party Cleanup] Deleted party ${party.id}: missing voice channel ID.`
        );

        continue;
      }

      const found = await findGuildChannel(client, party.voiceChannelId);

      if (!found) {
        await deletePartyDocument(doc.ref);
        deletedParties++;

        console.log(
          `[Party Cleanup] Deleted party ${party.id}: voice channel not found.`
        );

        continue;
      }

      const nonBotMembers = getNonBotMembers(found.channel);

      const decision = shouldDeleteParty({
        party,
        members,
        invited,
        nonBotMembers,
        age,
      });

      if (!decision.deleteParty) {
        continue;
      }

      if (decision.deleteChannel) {
        const deleted = await deletePartyChannel(
          found.guild,
          party.voiceChannelId
        );

        if (deleted) {
          deletedChannels++;
        }
      }

      await deletePartyDocument(doc.ref);
      deletedParties++;

      console.log(
        `[Party Cleanup] Deleted party ${party.id}: ${decision.reason}.`
      );
    }

    if (deletedParties > 0 || deletedChannels > 0) {
      console.log(
        `[Party Cleanup] Checked: ${checkedParties}, Parties deleted: ${deletedParties}, Channels deleted: ${deletedChannels}`
      );
    }
  } catch (error) {
    console.error("[Party Cleanup Error]:", error);
  }
}

function startPartyCleanup(client) {
  if (cleanupTimer) {
    console.log("[Party Cleanup] Service already running.");
    return cleanupTimer;
  }

  cleanupParties(client);

  cleanupTimer = setInterval(() => {
    cleanupParties(client);
  }, CLEANUP_INTERVAL_MS);

  cleanupTimer.unref?.();

  console.log(
    `[Party Cleanup] Service started. Interval: ${CLEANUP_INTERVAL_MS}ms`
  );

  return cleanupTimer;
}

function stopPartyCleanup() {
  if (!cleanupTimer) {
    return false;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;

  console.log("[Party Cleanup] Service stopped.");

  return true;
}

module.exports = {
  cleanupParties,
  startPartyCleanup,
  stopPartyCleanup,
};