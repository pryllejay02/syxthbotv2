const { db } = require("../../firebase/firebase");

const {
  removeMemberFromPartyVoice,
  safeDeletePartyVoiceChannel,
} = require("../services/partyService");

const ACTIVE_PARTY_STATUSES = ["forming", "ready", "raiding"];

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
    (member) => !member.user.bot
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

    const members = latestParty.members || [];
    const invited = latestParty.invited || [];

    const updatedMembers = members.filter((id) => id !== userId);
    const updatedInvited = invited.filter((id) => id !== userId);

    if (latestParty.leaderId === userId) {
      transaction.delete(partyRef);

      return {
        ok: true,
        deleted: true,
        leaderLeft: true,
        party: {
          id: party.id,
          ...latestParty,
        },
      };
    }

    if (updatedMembers.length === 0) {
      transaction.delete(partyRef);

      return {
        ok: true,
        deleted: true,
        leaderLeft: false,
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

module.exports = async function voiceStateUpdate(oldState, newState) {
  try {
    const member = oldState.member || newState.member;

    if (!member || member.user.bot) return;

    const userId = member.id;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (!oldChannel) return;

    // Ignore mute/deafen updates or same-channel updates.
    if (oldChannel.id === newChannel?.id) return;

    const party = await getPartyByVoiceChannelId(oldChannel.id);

    if (!party) return;

    if (!ACTIVE_PARTY_STATUSES.includes(party.status || "ready")) return;

    const isPartyMember =
      party.leaderId === userId ||
      (party.members || []).includes(userId) ||
      (party.invited || []).includes(userId);

    if (!isPartyMember) return;

    await removeMemberFromPartyVoice(oldChannel, userId);

    const result = await removeMemberFromPartyDocument(party, userId);

    if (!result.ok) return;

    const remainingNonBotMembers = getNonBotMembers(oldChannel);

    if (
      result.leaderLeft ||
      result.deleted ||
      remainingNonBotMembers.length === 0
    ) {
      await safeDeletePartyVoiceChannel(oldState.guild, party.voiceChannelId);

      console.log(
        `Party ${party.id} deleted because ${
          result.leaderLeft ? "leader left" : "voice channel became empty"
        }.`
      );

      return;
    }

    console.log(
      `User ${userId} removed from party ${party.id} because they left the party voice channel.`
    );
  } catch (error) {
    console.error("voiceStateUpdate party error:", error);
  }
};