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

function getMaxMembers() {
  return Number(partyConfig.maxMembers || 5);
}

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

function getUniqueInviteIds(message, userId) {
  return [...new Set(getMentions(message).map((user) => user.id))].filter(
    (id) => id !== userId
  );
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
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

function isInPartyQueue(message, worldConfig) {
  const voiceChannel = message.member?.voice?.channel;

  return (
    voiceChannel &&
    voiceChannel.id === worldConfig.partyQueueVoiceChannelId
  );
}

function getRemainingPartySlots(activeParty) {
  const members = getArray(activeParty.members);
  const invited = getArray(activeParty.invited);
  const maxMembers = Number(activeParty.maxMembers || getMaxMembers());

  return Math.max(0, maxMembers - members.length - invited.length);
}

function getCreateInviteLimit() {
  return Math.max(0, getMaxMembers() - 1);
}

function appendSkippedInviteMessages(reply, data = {}) {
  const {
    rawInviteIds = [],
    acceptedInviteIds = [],
    invalidInvites = [],
    alreadyBusy = [],
  } = data;

  let updatedReply = reply;

  if (rawInviteIds.length > acceptedInviteIds.length) {
    updatedReply += `\n\nℹ️ Invite list was limited to available party slots.`;
  }

  if (invalidInvites.length > 0) {
    updatedReply +=
      `\n⚠️ Skipped because of invalid world/character:\n` +
      invalidInvites
        .map((entry) => `• <@${entry.userId}> — ${entry.reason}`)
        .join("\n");
  }

  if (alreadyBusy.length > 0) {
    updatedReply +=
      `\n⚠️ Skipped because already in or invited to another party:\n` +
      alreadyBusy.map((id) => `• <@${id}>`).join("\n");
  }

  return updatedReply;
}

function formatPartyStatus(activeParty) {
  const members = getArray(activeParty.members);
  const invited = getArray(activeParty.invited);
  const maxMembers = Number(activeParty.maxMembers || getMaxMembers());

  return (
    `👥 **Party Status**\n\n` +
    `👑 Leader: <@${activeParty.leaderId}>\n` +
    `🌍 World: **${activeParty.worldId}**\n` +
    `👥 Members: **${members.length}/${maxMembers}**\n` +
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

module.exports = async function partyCommand(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const userId = message.author.id;

  if (!message.guild) {
    return message.reply("❌ Party commands can only be used inside a server.");
  }

  const player = await getPlayer(userId);

  if (!player) {
    return message.reply(
      "❌ You don’t have a character yet. Use `!s start` first."
    );
  }

  const worldId = player.world?.id;

  if (!worldId) {
    return message.reply("❌ You don’t have a selected world.");
  }

  const worldConfig = getWorldPartyConfig(worldId);

  if (!worldConfig) {
    return message.reply("❌ Party configuration for your world is missing.");
  }

  if (!worldConfig.formPartyChannelId) {
    return message.reply("❌ Form-party channel is missing in world config.");
  }

  if (!worldConfig.partyQueueVoiceChannelId) {
    return message.reply(
      "❌ Party queue voice channel is missing in world config."
    );
  }

  if (message.channel.id !== worldConfig.formPartyChannelId) {
    return message.reply(
      "❌ Party commands can only be used inside your world's form-party channel."
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

    if (!isInPartyQueue(message, worldConfig)) {
      return message.reply(
        "❌ You must join the **Party Queue Voice Channel** before creating a party."
      );
    }

    const rawInviteIds = getUniqueInviteIds(message, userId);

    if (rawInviteIds.length === 0) {
      return message.reply(
        "❌ Please mention members to invite.\n\n" +
          "Example: `!s party create @user1 @user2`"
      );
    }

    const { validInvites, invalidInvites } =
      await filterSameWorldInvites(rawInviteIds, worldId);

    const activeCheck = await filterUsersWithoutActiveParty(validInvites);

    const uniqueInvites = activeCheck.valid.slice(0, getCreateInviteLimit());

    if (uniqueInvites.length === 0) {
      let reply =
        "❌ No valid members to invite.\n\n" +
        "Members must have a character, be in the same world, and not be in another active party.";

      reply = appendSkippedInviteMessages(reply, {
        rawInviteIds,
        acceptedInviteIds: uniqueInvites,
        invalidInvites,
        alreadyBusy: activeCheck.alreadyBusy,
      });

      return message.reply(reply);
    }

    const partyVoiceChannel = await createPartyVoiceChannel(
      message,
      worldConfig,
      userId
    );

    if (!partyVoiceChannel) {
      return message.reply("❌ Failed to create party voice channel.");
    }

    await moveMemberToPartyVoice(message.member, partyVoiceChannel);

    const partyRef = db.collection("parties").doc();

    const createResult = await createPartyDocument({
      partyRef,
      worldId,
      leaderId: userId,
      invited: uniqueInvites,
      voiceChannelId: partyVoiceChannel.id,
    });

    if (!createResult.ok) {
      return message.reply(
        `❌ Failed to create party: ${createResult.message || "Unknown error"}`
      );
    }

    let reply =
      `👥 **Party Created!**\n\n` +
      `👑 Leader: <@${userId}>\n` +
      `🔊 Voice: <#${partyVoiceChannel.id}>\n` +
      `👥 Members: **1/${getMaxMembers()}**\n` +
      `📨 Invited: ${formatMentions(uniqueInvites)}\n\n` +
      `Invited members must join the **Party Queue Voice Channel** first, then type:\n` +
      `\`!s party accept\``;

    reply = appendSkippedInviteMessages(reply, {
      rawInviteIds,
      acceptedInviteIds: uniqueInvites,
      invalidInvites,
      alreadyBusy: activeCheck.alreadyBusy,
    });

    return message.reply(reply);
  }

  if (subCommand === "accept") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You don’t have any pending party invitation.");
    }

    const invited = getArray(activeParty.invited);

    if (!invited.includes(userId)) {
      return message.reply("❌ You are not invited to this party.");
    }

    if (player.world?.id !== activeParty.worldId) {
      return message.reply(
        "❌ You cannot accept this party invitation because you are in a different world."
      );
    }

    if (!isInPartyQueue(message, worldConfig)) {
      return message.reply(
        "❌ You must join the **Party Queue Voice Channel** before accepting the invitation."
      );
    }

    const currentMembers = getArray(activeParty.members);
    const maxMembers = Number(activeParty.maxMembers || getMaxMembers());

    if (currentMembers.length >= maxMembers) {
      return message.reply("❌ This party is already full.");
    }

    const partyVoiceChannel = await getPartyVoiceChannel(
      message,
      activeParty,
      worldConfig
    );

    if (!partyVoiceChannel) {
      return message.reply(
        "❌ Failed to find or create the party voice channel."
      );
    }

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

    const updatedMembers =
      acceptResult.updatedMembers ||
      acceptResult.party?.members ||
      [];

    return message.reply(
      `✅ <@${userId}> joined the party!\n\n` +
        `👥 Members: **${updatedMembers.length}/${maxMembers}**\n` +
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

    const rawInviteIds = getUniqueInviteIds(message, userId);

    if (rawInviteIds.length === 0) {
      return message.reply("❌ Mention a member to invite.");
    }

    const remainingSlots = getRemainingPartySlots(activeParty);

    if (remainingSlots <= 0) {
      return message.reply("❌ Your party is already full.");
    }

    const { validInvites, invalidInvites } =
      await filterSameWorldInvites(rawInviteIds, activeParty.worldId);

    const activeCheck = await filterUsersWithoutActiveParty(validInvites);
    const limitedInvites = activeCheck.valid.slice(0, remainingSlots);

    if (limitedInvites.length === 0) {
      let reply =
        "❌ No valid members to invite.\n\n" +
        "Members must have a character, be in the same world, and not be in another active party.";

      reply = appendSkippedInviteMessages(reply, {
        rawInviteIds,
        acceptedInviteIds: limitedInvites,
        invalidInvites,
        alreadyBusy: activeCheck.alreadyBusy,
      });

      return message.reply(reply);
    }

    const inviteResult = await addInvitesToParty(
      activeParty.id,
      limitedInvites
    );

    if (!inviteResult.ok) {
      return message.reply(`❌ ${inviteResult.message}`);
    }

    let reply =
      `📨 Invited: ${formatMentions(inviteResult.newInvites || limitedInvites)}\n\n` +
      `They must join the **Party Queue Voice Channel** and type:\n` +
      `\`!s party accept\``;

    reply = appendSkippedInviteMessages(reply, {
      rawInviteIds,
      acceptedInviteIds: limitedInvites,
      invalidInvites,
      alreadyBusy: activeCheck.alreadyBusy,
    });

    return message.reply(reply);
  }

  if (subCommand === "status") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You are not in a party.");
    }

    return message.reply(formatPartyStatus(activeParty));
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