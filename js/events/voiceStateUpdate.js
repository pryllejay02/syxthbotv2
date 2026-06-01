const { db } = require("../../firebase/firebase");

const {
  removeMemberFromPartyVoice,
  safeDeletePartyVoiceChannel,
} = require("../services/partyService");

const ACTIVE_PARTY_STATUSES = ["forming", "ready", "raiding"];

function isActivePartyStatus(status) {
  return ACTIVE_PARTY_STATUSES.includes(status || "ready");
}

async function getPartyByVoiceChannelId(voiceChannelId) {
  if (!voiceChannelId) return null;

  const snapshot = await db
    .collection("parties")
    .where("voiceChannelId", "==", voiceChannelId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];

  return {
    id: doc.id,
    ...doc.data(),
  };
}

function getNonBotMembers(channel) {
  if (!channel) return [];

  return [...channel.members.values()].filter(
    (member) => !member.user?.bot
  );
}

function isUserInParty(party, userId) {
  const members = Array.isArray(party.members) ? party.members : [];
  const invited = Array.isArray(party.invited) ? party.invited : [];

  return (
    party.leaderId === userId ||
    members.includes(userId) ||
    invited.includes(userId)
  );
}

async function removeMemberFromPartyDocument(party, userId) {
  const partyRef = db.collection("parties").doc(party.id);

  return db.runTransaction(async (transaction) => {
    const partyDoc = await transaction.get(partyRef);

    if (!partyDoc.exists) {
      return {
        ok: false,
        message: "Party no longer exists.",
      };
    }

    const latestParty = partyDoc.data();

    const members = Array.isArray(latestParty.members)
      ? latestParty.members
      : [];

    const invited = Array.isArray(latestParty.invited)
      ? latestParty.invited
      : [];

    const updatedMembers = members.filter((id) => id !== userId);
    const updatedInvited = invited.filter((id) => id !== userId);

    const leaderLeft = latestParty.leaderId === userId;
    const noMembersLeft = updatedMembers.length === 0;

    if (leaderLeft || noMembersLeft) {
      transaction.delete(partyRef);

      return {
        ok: true,
        deleted: true,
        leaderLeft,
        noMembersLeft,
        party: {
          id: party.id,
          ...latestParty,
        },
      };
    }

    transaction.update(partyRef, {
      members: updatedMembers,
      invited: updatedInvited,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      deleted: false,
      leaderLeft: false,
      noMembersLeft: false,
      updatedMembers,
      updatedInvited,
      party: {
        id: party.id,
        ...latestParty,
        members: updatedMembers,
        invited: updatedInvited,
      },
    };
  });
}

async function handlePartyChannelCleanup(oldState, oldChannel, party, result) {
  const remainingNonBotMembers = getNonBotMembers(oldChannel);

  const shouldDeleteChannel =
    result.leaderLeft ||
    result.deleted ||
    result.noMembersLeft ||
    remainingNonBotMembers.length === 0;

  if (!shouldDeleteChannel) {
    return false;
  }

  await safeDeletePartyVoiceChannel(
    oldState.guild,
    party.voiceChannelId
  );

  console.log(
    `Party ${party.id} deleted because ${
      result.leaderLeft
        ? "leader left"
        : remainingNonBotMembers.length === 0
        ? "voice channel became empty"
        : "no members remained"
    }.`
  );

  return true;
}

module.exports = async function voiceStateUpdate(oldState, newState) {
  try {
    const member = oldState.member || newState.member;

    if (!member || member.user?.bot) return;

    const userId = member.id;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // Ignore join-only events.
    if (!oldChannel) return;

    // Ignore mute/deafen/same-channel updates.
    if (oldChannel.id === newChannel?.id) return;

    const party = await getPartyByVoiceChannelId(oldChannel.id);

    if (!party) return;

    if (!isActivePartyStatus(party.status)) return;

    if (!isUserInParty(party, userId)) return;

    await removeMemberFromPartyVoice(oldChannel, userId).catch(() => null);

    const result = await removeMemberFromPartyDocument(party, userId);

    if (!result.ok) return;

    const channelDeleted = await handlePartyChannelCleanup(
      oldState,
      oldChannel,
      party,
      result
    );

    if (channelDeleted) return;

    console.log(
      `User ${userId} removed from party ${party.id} because they left the party voice channel.`
    );
  } catch (error) {
    console.error("voiceStateUpdate party error:", error);
  }
};