const {
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");

async function createPartyVoiceChannel(message, worldConfig, leaderId) {
  const partyVoiceChannel = await message.guild.channels.create({
    name: `Party-${message.author.username}`,
    type: ChannelType.GuildVoice,
    parent: worldConfig.partyVoiceCategoryId,
    permissionOverwrites: [
      {
        id: message.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.Connect],
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
  });

  return partyVoiceChannel;
}

async function allowMemberInPartyVoice(channel, userId) {
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
  });
}

async function moveMemberToPartyVoice(member, channel) {
  await member.voice.setChannel(channel).catch(() => null);
}

async function createPartyDocument({
  partyRef,
  worldId,
  leaderId,
  invited,
  voiceChannelId,
}) {
  await partyRef.set({
    partyId: partyRef.id,
    worldId,
    leaderId,
    members: [leaderId],
    invited,
    voiceChannelId,
    status: "ready",
    maxMembers: partyConfig.maxMembers,
    createdAt: new Date(),
  });
}

async function updatePartyMembers(partyId, members, invited, voiceChannelId) {
  await db.collection("parties").doc(partyId).update({
    members,
    invited,
    voiceChannelId,
    status: "ready",
  });
}

async function disbandParty(activeParty, guild) {
  if (activeParty.voiceChannelId) {
    const channel = await guild.channels
      .fetch(activeParty.voiceChannelId)
      .catch(() => null);

    if (channel) {
      await channel.delete().catch(() => null);
    }
  }

await db.collection("parties").doc(activeParty.id).delete();

}

module.exports = {
  createPartyVoiceChannel,
  allowMemberInPartyVoice,
  moveMemberToPartyVoice,
  createPartyDocument,
  updatePartyMembers,
  disbandParty,
};