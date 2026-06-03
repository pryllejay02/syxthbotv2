const {
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");

function getMaxMembers() {
  return Number(partyConfig.maxMembers || 5);
}

function getPartyName(username, userId = "") {
  const cleanName = String(username || "Adventurer")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .slice(0, 20);

  const suffix = userId ? `-${String(userId).slice(-4)}` : "";

  return `Party-${cleanName || "Adventurer"}${suffix}`;
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueIds(ids = []) {
  return [...new Set(ids.filter(Boolean))];
}

function getSafePartyStatus(status = "ready") {
  const currentStatus = String(status || "ready").toLowerCase();

  if (currentStatus === "raiding") return "raiding";

  return "ready";
}

async function createPartyVoiceChannel(message, worldConfig, leaderId) {
  if (!message.guild) return null;
  if (!worldConfig?.partyVoiceCategoryId) return null;
  if (!leaderId) return null;

  const leaderMember = await message.guild.members
    .fetch(leaderId)
    .catch(() => null);

  const leaderName =
    leaderMember?.user?.username ||
    message.author?.username ||
    "Adventurer";

  const permissionOverwrites = [
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
  ];

  if (message.client?.user?.id) {
    permissionOverwrites.push({
      id: message.client.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
        PermissionsBitField.Flags.MoveMembers,
        PermissionsBitField.Flags.ManageChannels,
      ],
    });
  }

  const partyVoiceChannel = await message.guild.channels
    .create({
      name: getPartyName(leaderName, leaderId),
      type: ChannelType.GuildVoice,
      parent: worldConfig.partyVoiceCategoryId,
      userLimit: getMaxMembers(),
      permissionOverwrites,
      reason: "Syxth MMORPG party voice channel created.",
    })
    .catch((error) => {
      console.error("Failed to create party voice channel:", error);
      return null;
    });

  return partyVoiceChannel;
}

async function allowMemberInPartyVoice(channel, userId) {
  if (!channel || !userId) return false;

  const success = await channel.permissionOverwrites
    .edit(userId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
    })
    .then(() => true)
    .catch((error) => {
      console.error("Failed to allow member in party voice:", error);
      return false;
    });

  return success;
}

async function removeMemberFromPartyVoice(channel, userId) {
  if (!channel || !userId) return false;

  const success = await channel.permissionOverwrites
    .delete(userId)
    .then(() => true)
    .catch((error) => {
      console.error("Failed to remove member from party voice:", error);
      return false;
    });

  return success;
}

async function moveMemberToPartyVoice(member, channel) {
  if (!member || !channel) return false;
  if (!member.voice?.channel) return false;

  const success = await member.voice
    .setChannel(channel)
    .then(() => true)
    .catch((error) => {
      console.error("Failed to move member to party voice:", error);
      return false;
    });

  return success;
}

async function safeDeletePartyVoiceChannel(guild, voiceChannelId) {
  if (!guild || !voiceChannelId) return false;

  const channel = await guild.channels
    .fetch(voiceChannelId)
    .catch(() => null);

  if (!channel) return false;

  const deleted = await channel
    .delete("Syxth MMORPG party voice channel cleanup.")
    .then(() => true)
    .catch((error) => {
      console.error("Failed to delete party voice channel:", error);
      return false;
    });

  return deleted;
}

async function createPartyDocument({
  partyRef,
  worldId,
  leaderId,
  invited,
  voiceChannelId,
}) {
  if (!partyRef || !worldId || !leaderId) {
    return {
      ok: false,
      message: "Missing required party data.",
    };
  }

  const maxMembers = getMaxMembers();

  const uniqueInvited = uniqueIds(invited)
    .filter((id) => id !== leaderId)
    .slice(0, Math.max(0, maxMembers - 1));

  const partyData = {
    partyId: partyRef.id,
    worldId,
    leaderId,
    members: [leaderId],
    invited: uniqueInvited,
    voiceChannelId: voiceChannelId || null,
    status: "ready",
    maxMembers,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await partyRef.set(partyData);

  return {
    ok: true,
    ...partyData,
  };
}

async function updatePartyMembers(partyId, members, invited, voiceChannelId) {
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

    const uniqueMembers = uniqueIds(members);
    const uniqueInvited = uniqueIds(invited).filter(
      (id) => !uniqueMembers.includes(id)
    );

    const status = getSafePartyStatus(party.status);

    transaction.update(partyRef, {
      members: uniqueMembers,
      invited: uniqueInvited,
      voiceChannelId: voiceChannelId || null,
      status,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      partyId,
      members: uniqueMembers,
      invited: uniqueInvited,
      voiceChannelId: voiceChannelId || null,
      status,
    };
  });
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

    const members = getArray(party.members);
    const invited = getArray(party.invited);

    const maxMembers = Number(party.maxMembers || getMaxMembers());
    const currentCount = members.length + invited.length;
    const availableSlots = Math.max(0, maxMembers - currentCount);

    if (availableSlots <= 0) {
      return {
        ok: false,
        message: "Party is already full or has max pending invites.",
      };
    }

    const newInvites = uniqueIds(inviteIds)
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

    const members = getArray(party.members);
    const invited = getArray(party.invited);

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

    const maxMembers = Number(party.maxMembers || getMaxMembers());

    if (members.length >= maxMembers) {
      return {
        ok: false,
        message: "This party is already full.",
      };
    }

    const updatedMembers = uniqueIds([...members, userId]);
    const updatedInvited = invited.filter((id) => id !== userId);

    const updatedVoiceChannelId =
      voiceChannelId || party.voiceChannelId || null;

    const status = getSafePartyStatus(party.status);

    transaction.update(partyRef, {
      members: updatedMembers,
      invited: updatedInvited,
      voiceChannelId: updatedVoiceChannelId,
      status,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      party: {
        id: partyId,
        ...party,
        members: updatedMembers,
        invited: updatedInvited,
        voiceChannelId: updatedVoiceChannelId,
        status,
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

    const members = getArray(party.members);
    const invited = getArray(party.invited);

    const updatedMembers = members.filter((id) => id !== userId);
    const updatedInvited = invited.filter((id) => id !== userId);

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
  if (!activeParty?.id) return false;

  if (activeParty.voiceChannelId) {
    await safeDeletePartyVoiceChannel(guild, activeParty.voiceChannelId);
  }

  await db
    .collection("parties")
    .doc(activeParty.id)
    .delete()
    .catch((error) => {
      console.error("Failed to delete party document:", error);
    });

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