const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");

const {
  getWorldPartyConfig,
  getMentions,
  getPlayer,
  findUserActiveParty,
  filterSameWorldInvites,
} = require("../utils/partyUtils");

const {
  createPartyVoiceChannel,
  allowMemberInPartyVoice,
  removeMemberFromPartyVoice,
  moveMemberToPartyVoice,
  createPartyDocument,
  addInvitesToParty,
  acceptPartyInvite,
  removeMemberFromParty,
  disbandParty,
} = require("../services/partyService");

function getPartyHelp() {
  return (
    `👥 **PARTY COMMANDS**\n\n` +
    `\`!s party create @member1 @member2\`\n` +
    `Create a party and invite members.\n\n` +
    `\`!s party accept\`\n` +
    `Accept a party invitation while inside the Party Queue voice channel.\n\n` +
    `\`!s party invite @member\`\n` +
    `Invite more members if there is still a slot. Leader only.\n\n` +
    `\`!s party status\`\n` +
    `View your current party.\n\n` +
    `\`!s party leave\`\n` +
    `Leave your party.\n\n` +
    `\`!s party disband\`\n` +
    `Disband party. Leader only.`
  );
}

function formatMentions(ids = []) {
  if (!ids.length) return "None";
  return ids.map((id) => `<@${id}>`).join(", ");
}

async function filterUsersWithoutActiveParty(userIds = []) {
  const valid = [];
  const alreadyBusy = [];

  for (const id of userIds) {
    const activeParty = await findUserActiveParty(id);

    if (activeParty) {
      alreadyBusy.push(id);
    } else {
      valid.push(id);
    }
  }

  return {
    valid,
    alreadyBusy,
  };
}

async function getPartyVoiceChannel(message, activeParty, worldConfig) {
  if (activeParty.voiceChannelId) {
    const existingChannel = await message.guild.channels
      .fetch(activeParty.voiceChannelId)
      .catch(() => null);

    if (existingChannel) return existingChannel;
  }

  return createPartyVoiceChannel(
    message,
    worldConfig,
    activeParty.leaderId
  );
}

module.exports = async function partyCommand(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const userId = message.author.id;

  const player = await getPlayer(userId);

  if (!player) {
    return message.reply("❌ You don’t have a character yet. Use `!s start` first.");
  }

  const worldId = player.world?.id;

  if (!worldId) {
    return message.reply("❌ You don’t have a selected world.");
  }

  const worldConfig = getWorldPartyConfig(worldId);

  if (!worldConfig) {
    return message.reply("❌ Party configuration for your world is missing.");
  }

  if (message.channel.id !== worldConfig.formPartyChannelId) {
    return message.reply(
      "❌ Party commands can only be used inside the form-party channel for your world."
    );
  }

  if (!subCommand || subCommand === "help") {
    return message.reply(getPartyHelp());
  }

  if (subCommand === "create") {
    const existingParty = await findUserActiveParty(userId);

    if (existingParty) {
      return message.reply("❌ You are already in or invited to a party.");
    }

    const leaderVoiceChannel = message.member.voice.channel;

    if (
      !leaderVoiceChannel ||
      leaderVoiceChannel.id !== worldConfig.partyQueueVoiceChannelId
    ) {
      return message.reply(
        "❌ You must join the **Party Queue Voice Channel** before creating a party."
      );
    }

    const mentions = getMentions(message);

    if (mentions.length === 0) {
      return message.reply(
        "❌ Please mention members to invite.\n\nExample: `!s party create @user1 @user2`"
      );
    }

    const rawInviteIds = [...new Set(mentions.map((user) => user.id))]
      .filter((id) => id !== userId);

    const { validInvites, invalidInvites } =
      await filterSameWorldInvites(rawInviteIds, worldId);

    const activeCheck = await filterUsersWithoutActiveParty(validInvites);

    const uniqueInvites = activeCheck.valid.slice(
      0,
      partyConfig.maxMembers - 1
    );

    if (uniqueInvites.length === 0) {
      return message.reply(
        "❌ No valid members to invite.\n\n" +
          "Members must have a character, be in the same world, and not be in another active party."
      );
    }

    const partyVoiceChannel = await createPartyVoiceChannel(
      message,
      worldConfig,
      userId
    );

    await moveMemberToPartyVoice(message.member, partyVoiceChannel);

    const partyRef = db.collection("parties").doc();

    await createPartyDocument({
      partyRef,
      worldId,
      leaderId: userId,
      invited: uniqueInvites,
      voiceChannelId: partyVoiceChannel.id,
    });

    let reply =
      `👥 **Party Created!**\n\n` +
      `👑 Leader: <@${userId}>\n` +
      `🔊 Voice: <#${partyVoiceChannel.id}>\n` +
      `👥 Members: **1/${partyConfig.maxMembers}**\n` +
      `📨 Invited: ${formatMentions(uniqueInvites)}\n\n` +
      `Invited members must join the **Party Queue Voice Channel** first, then type:\n` +
      `\`!s party accept\``;

    if (invalidInvites.length > 0) {
      reply +=
        `\n\n⚠️ Some mentioned users were skipped because they have no character or are in a different world.`;
    }

    if (activeCheck.alreadyBusy.length > 0) {
      reply +=
        `\n⚠️ Some mentioned users were skipped because they are already in or invited to another party.`;
    }

    return message.reply(reply);
  }

  if (subCommand === "accept") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You don’t have any pending party invitation.");
    }

    if (!(activeParty.invited || []).includes(userId)) {
      return message.reply("❌ You are not invited to this party.");
    }

    if (player.world?.id !== activeParty.worldId) {
      return message.reply(
        "❌ You cannot accept this party invitation because you are in a different world."
      );
    }

    const voiceChannel = message.member.voice.channel;

    if (
      !voiceChannel ||
      voiceChannel.id !== worldConfig.partyQueueVoiceChannelId
    ) {
      return message.reply(
        "❌ You must join the **Party Queue Voice Channel** before accepting the invitation."
      );
    }

    const partyVoiceChannel = await getPartyVoiceChannel(
      message,
      activeParty,
      worldConfig
    );

    const acceptResult = await acceptPartyInvite(
      activeParty.id,
      userId,
      partyVoiceChannel.id
    );

    if (!acceptResult.ok) {
      return message.reply(`❌ ${acceptResult.message}`);
    }

    await allowMemberInPartyVoice(partyVoiceChannel, userId);
    await moveMemberToPartyVoice(message.member, partyVoiceChannel);

    const updatedMembers = acceptResult.updatedMembers ||
      acceptResult.party?.members ||
      [];

    return message.reply(
      `✅ <@${userId}> joined the party!\n\n` +
        `👥 Members: **${updatedMembers.length}/${partyConfig.maxMembers}**\n` +
        `🔊 Voice: <#${partyVoiceChannel.id}>`
    );
  }

  if (subCommand === "invite") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You don’t have an active party.");
    }

    if (activeParty.leaderId !== userId) {
      return message.reply("❌ Only the party leader can invite members.");
    }

    const mentions = getMentions(message);

    if (mentions.length === 0) {
      return message.reply("❌ Mention a member to invite.");
    }

    const rawInviteIds = [...new Set(mentions.map((user) => user.id))]
      .filter((id) => id !== userId);

    const { validInvites, invalidInvites } =
      await filterSameWorldInvites(rawInviteIds, activeParty.worldId);

    const activeCheck = await filterUsersWithoutActiveParty(validInvites);

    const inviteResult = await addInvitesToParty(
      activeParty.id,
      activeCheck.valid
    );

    if (!inviteResult.ok) {
      return message.reply(`❌ ${inviteResult.message}`);
    }

    let reply =
      `📨 Invited: ${formatMentions(inviteResult.newInvites)}\n\n` +
      `They must join the **Party Queue Voice Channel** and type:\n` +
      `\`!s party accept\``;

    if (invalidInvites.length > 0) {
      reply +=
        `\n\n⚠️ Some mentioned users were skipped because they have no character or are in a different world.`;
    }

    if (activeCheck.alreadyBusy.length > 0) {
      reply +=
        `\n⚠️ Some mentioned users were skipped because they are already in or invited to another party.`;
    }

    return message.reply(reply);
  }

  if (subCommand === "status") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You are not in a party.");
    }

    const members = activeParty.members || [];
    const invited = activeParty.invited || [];

    return message.reply(
      `👥 **Party Status**\n\n` +
        `👑 Leader: <@${activeParty.leaderId}>\n` +
        `🌍 World: **${activeParty.worldId}**\n` +
        `👥 Members: **${members.length}/${partyConfig.maxMembers}**\n` +
        `${formatMentions(members)}\n\n` +
        `📨 Invited: ${formatMentions(invited)}\n` +
        `📊 Status: **${activeParty.status || "ready"}**\n` +
        `🔊 Voice: ${
          activeParty.voiceChannelId
            ? `<#${activeParty.voiceChannelId}>`
            : "Not created yet"
        }`
    );
  }

  if (subCommand === "leave") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You are not in a party.");
    }

    if (activeParty.leaderId === userId) {
      return message.reply(
        "❌ Party leaders cannot leave. Use `!s party disband` instead."
      );
    }

    const leaveResult = await removeMemberFromParty(activeParty.id, userId);

    if (!leaveResult.ok) {
      return message.reply(`❌ ${leaveResult.message}`);
    }

    if (activeParty.voiceChannelId) {
      const channel = await message.guild.channels
        .fetch(activeParty.voiceChannelId)
        .catch(() => null);

      if (channel) {
        await removeMemberFromPartyVoice(channel, userId);
      }
    }

    return message.reply("✅ You left the party.");
  }

  if (subCommand === "disband") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You don’t have an active party.");
    }

    if (activeParty.leaderId !== userId) {
      return message.reply("❌ Only the party leader can disband the party.");
    }

    await disbandParty(activeParty, message.guild);

    return message.reply("🛑 Party disbanded.");
  }

  return message.reply("❌ Unknown party command. Use `!s party help`.");
};