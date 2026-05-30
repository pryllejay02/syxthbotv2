const {
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");

function getPartyName(username) {
  const cleanName = String(username || "Adventurer")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .slice(0, 20);

  return `Party-${cleanName || "Adventurer"}`;
}

async function createPartyVoiceChannel(message, worldConfig, leaderId) {
  const partyVoiceChannel = await message.guild.channels.create({
    name: getPartyName(message.author.username),
    type: ChannelType.GuildVoice,
    parent: worldConfig.partyVoiceCategoryId,
    permissionOverwrites: [
      {
        id: message.guild.roles.everyone.id,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
        ],
      },
      {
        id: leaderId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
        ],
      },
    ],
    reason: "Syxth MMORPG party voice channel created.",
  });

  return partyVoiceChannel;
}

async function allowMemberInPartyVoice(channel, userId) {
  if (!channel || !userId) return false;

  await channel.permissionOverwrites
    .edit(userId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
    })
    .catch(() => null);

  return true;
}

async function removeMemberFromPartyVoice(channel, userId) {
  if (!channel || !userId) return false;

  await channel.permissionOverwrites
    .delete(userId)
    .catch(() => null);

  return true;
}

async function moveMemberToPartyVoice(member, channel) {
  if (!member || !channel) return false;
  if (!member.voice?.channel) return false;

  await member.voice.setChannel(channel).catch(() => null);

  return true;
}

async function safeDeletePartyVoiceChannel(guild, voiceChannelId) {
  if (!guild || !voiceChannelId) return false;

  const channel = await guild.channels
    .fetch(voiceChannelId)
    .catch(() => null);

  if (!channel) return false;

  await channel.delete().catch(() => null);

  return true;
}

async function createPartyDocument({
  partyRef,
  worldId,
  leaderId,
  invited,
  voiceChannelId,
}) {
  const uniqueInvited = [...new Set(invited || [])].filter(
    (id) => id && id !== leaderId
  );

  await partyRef.set({
    partyId: partyRef.id,
    worldId,
    leaderId,
    members: [leaderId],
    invited: uniqueInvited,
    voiceChannelId,
    status: "ready",
    maxMembers: partyConfig.maxMembers,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    partyId: partyRef.id,
    worldId,
    leaderId,
    members: [leaderId],
    invited: uniqueInvited,
    voiceChannelId,
    status: "ready",
    maxMembers: partyConfig.maxMembers,
  };
}

async function updatePartyMembers(partyId, members, invited, voiceChannelId) {
  const partyRef = db.collection("parties").doc(partyId);

  const uniqueMembers = [...new Set(members || [])];
  const uniqueInvited = [...new Set(invited || [])].filter(
    (id) => !uniqueMembers.includes(id)
  );

  await partyRef.update({
    members: uniqueMembers,
    invited: uniqueInvited,
    voiceChannelId,
    status: "ready",
    updatedAt: new Date(),
  });

  return {
    partyId,
    members: uniqueMembers,
    invited: uniqueInvited,
    voiceChannelId,
  };
}

async function addInvitesToParty(partyId, inviteIds = []) {
  const partyRef = db.collection("parties").doc(partyId);

  return db.runTransaction(async (transaction) => {
    const partyDoc = await transaction.get(partyRef);

    if (!partyDoc.exists) {
      return {
        ok: false,
        message: "Party no longer exists.",
      };
    }

    const party = partyDoc.data();
    const members = party.members || [];
    const invited = party.invited || [];

    const currentCount = members.length + invited.length;
    const maxMembers = Number(party.maxMembers || partyConfig.maxMembers);

    const availableSlots = Math.max(0, maxMembers - currentCount);

    if (availableSlots <= 0) {
      return {
        ok: false,
        message: "Party is already full or has max pending invites.",
      };
    }

    const newInvites = [...new Set(inviteIds)]
      .filter(
        (id) =>
          id &&
          !members.includes(id) &&
          !invited.includes(id) &&
          id !== party.leaderId
      )
      .slice(0, availableSlots);

    if (newInvites.length === 0) {
      return {
        ok: false,
        message: "No valid new invites.",
      };
    }

    const updatedInvited = [...invited, ...newInvites];

    transaction.update(partyRef, {
      invited: updatedInvited,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      partyId,
      newInvites,
      updatedInvited,
      availableSlots,
    };
  });
}

async function acceptPartyInvite(partyId, userId, voiceChannelId) {
  const partyRef = db.collection("parties").doc(partyId);

  return db.runTransaction(async (transaction) => {
    const partyDoc = await transaction.get(partyRef);

    if (!partyDoc.exists) {
      return {
        ok: false,
        message: "Party no longer exists.",
      };
    }

    const party = partyDoc.data();
    const members = party.members || [];
    const invited = party.invited || [];

    if (!invited.includes(userId)) {
      return {
        ok: false,
        message: "You are not invited to this party.",
      };
    }

    if (members.includes(userId)) {
      return {
        ok: true,
        alreadyMember: true,
        party: {
          id: partyId,
          ...party,
        },
      };
    }

    const maxMembers = Number(party.maxMembers || partyConfig.maxMembers);

    if (members.length >= maxMembers) {
      return {
        ok: false,
        message: "This party is already full.",
      };
    }

    const updatedMembers = [...new Set([...members, userId])];
    const updatedInvited = invited.filter((id) => id !== userId);

    transaction.update(partyRef, {
      members: updatedMembers,
      invited: updatedInvited,
      voiceChannelId,
      status: "ready",
      updatedAt: new Date(),
    });

    return {
      ok: true,
      party: {
        id: partyId,
        ...party,
        members: updatedMembers,
        invited: updatedInvited,
        voiceChannelId,
      },
      updatedMembers,
      updatedInvited,
    };
  });
}

async function removeMemberFromParty(partyId, userId) {
  const partyRef = db.collection("parties").doc(partyId);

  return db.runTransaction(async (transaction) => {
    const partyDoc = await transaction.get(partyRef);

    if (!partyDoc.exists) {
      return {
        ok: false,
        message: "Party no longer exists.",
      };
    }

    const party = partyDoc.data();

    if (party.leaderId === userId) {
      return {
        ok: false,
        message: "Leader cannot leave. Use disband instead.",
      };
    }

    const updatedMembers = (party.members || []).filter(
      (id) => id !== userId
    );

    const updatedInvited = (party.invited || []).filter(
      (id) => id !== userId
    );

    if (updatedMembers.length === 0) {
      transaction.delete(partyRef);

      return {
        ok: true,
        deleted: true,
        party: {
          id: partyId,
          ...party,
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
      party: {
        id: partyId,
        ...party,
        members: updatedMembers,
        invited: updatedInvited,
      },
      updatedMembers,
      updatedInvited,
    };
  });
}

async function disbandParty(activeParty, guild) {
  if (activeParty.voiceChannelId) {
    await safeDeletePartyVoiceChannel(guild, activeParty.voiceChannelId);
  }

  await db
    .collection("parties")
    .doc(activeParty.id)
    .delete()
    .catch(() => null);

  return true;
}

module.exports = {
  createPartyVoiceChannel,
  allowMemberInPartyVoice,
  removeMemberFromPartyVoice,
  moveMemberToPartyVoice,
  safeDeletePartyVoiceChannel,
  createPartyDocument,
  updatePartyMembers,
  addInvitesToParty,
  acceptPartyInvite,
  removeMemberFromParty,
  disbandParty,
};