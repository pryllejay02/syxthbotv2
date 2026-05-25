const {
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");

function getWorldPartyConfig(worldId) {
  return partyConfig.worlds[worldId] || null;
}

function getMentions(message) {
  return [...message.mentions.users.values()].filter(
    (user) => !user.bot
  );
}

async function findUserActiveParty(userId) {
  const snapshot = await db
    .collection("parties")
    .where("status", "in", ["forming", "ready", "raiding"])
    .get();

  for (const doc of snapshot.docs) {
    const party = doc.data();

    const members = party.members || [];
    const invited = party.invited || [];

    if (
      party.leaderId === userId ||
      members.includes(userId) ||
      invited.includes(userId)
    ) {
      return {
        id: doc.id,
        ...party,
      };
    }
  }

  return null;
}

async function getPlayer(userId) {
  const playerDoc = await db.collection("players").doc(userId).get();

  if (!playerDoc.exists) return null;

  return playerDoc.data();
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
      `❌ Party commands can only be used inside the form-party channel for your world.`
    );
  }

  if (!subCommand || subCommand === "help") {
    return message.reply(
      `👥 **PARTY COMMANDS**\n\n` +
        `\`!s party create @member1 @member2\`\n` +
        `Create a party and invite members.\n\n` +
        `\`!s party accept\`\n` +
        `Accept a party invitation while inside the Party Queue voice channel.\n\n` +
        `\`!s party invite @member\`\n` +
        `Invite more members if there is still a slot.\n\n` +
        `\`!s party status\`\n` +
        `View your current party.\n\n` +
        `\`!s party leave\`\n` +
        `Leave your party.\n\n` +
        `\`!s party disband\`\n` +
        `Disband party. Leader only.`
    );
  }

  if (subCommand === "create") {
    const existingParty = await findUserActiveParty(userId);

    if (existingParty) {
      return message.reply("❌ You are already in or invited to a party.");
    }

    const mentions = getMentions(message);

    if (mentions.length === 0) {
      return message.reply(
        "❌ Please mention members to invite.\n\nExample: `!s party create @user1 @user2`"
      );
    }

    const uniqueInvites = [...new Set(mentions.map((user) => user.id))]
      .filter((id) => id !== userId)
      .slice(0, partyConfig.maxMembers - 1);

    if (uniqueInvites.length === 0) {
      return message.reply("❌ You need to invite at least one valid member.");
    }

    const partyRef = db.collection("parties").doc();

    await partyRef.set({
      partyId: partyRef.id,
      worldId,
      leaderId: userId,
      members: [userId],
      invited: uniqueInvites,
      voiceChannelId: null,
      status: "forming",
      maxMembers: partyConfig.maxMembers,
      createdAt: new Date(),
    });

    return message.reply(
      `👥 **Party Created!**\n\n` +
        `👑 Leader: <@${userId}>\n` +
        `📨 Invited: ${uniqueInvites.map((id) => `<@${id}>`).join(", ")}\n\n` +
        `Invited members must join the **Party Queue Voice Channel** first, then type:\n` +
        `\`!s party accept\``
    );
  }

  if (subCommand === "accept") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You don’t have any pending party invitation.");
    }

    if (!(activeParty.invited || []).includes(userId)) {
      return message.reply("❌ You are not invited to this party.");
    }

    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel || voiceChannel.id !== worldConfig.partyQueueVoiceChannelId) {
      return message.reply(
        "❌ You must join the **Party Queue Voice Channel** before accepting the invitation."
      );
    }

    const members = activeParty.members || [];

    if (members.length >= partyConfig.maxMembers) {
      return message.reply("❌ This party is already full.");
    }

    let partyVoiceChannelId = activeParty.voiceChannelId;
    let partyVoiceChannel = null;

    if (partyVoiceChannelId) {
      partyVoiceChannel = await message.guild.channels
        .fetch(partyVoiceChannelId)
        .catch(() => null);
    }

    if (!partyVoiceChannel) {
      partyVoiceChannel = await message.guild.channels.create({
        name: `Party-${message.author.username}`,
        type: ChannelType.GuildVoice,
        parent: worldConfig.partyVoiceCategoryId,
        permissionOverwrites: [
          {
            id: message.guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.Connect],
          },
          {
            id: activeParty.leaderId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
            ],
          },
        ],
      });

      partyVoiceChannelId = partyVoiceChannel.id;
    }

    await partyVoiceChannel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
    });

    await message.member.voice.setChannel(partyVoiceChannel).catch(() => null);

    const updatedMembers = [...new Set([...members, userId])];
    const updatedInvited = (activeParty.invited || []).filter(
      (id) => id !== userId
    );

    await db.collection("parties").doc(activeParty.id).update({
      members: updatedMembers,
      invited: updatedInvited,
      voiceChannelId: partyVoiceChannelId,
      status: "ready",
    });

    return message.reply(
      `✅ <@${userId}> joined the party!\n\n` +
        `👥 Members: ${updatedMembers.length}/${partyConfig.maxMembers}`
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

    const currentCount =
      Number((activeParty.members || []).length) +
      Number((activeParty.invited || []).length);

    if (currentCount >= partyConfig.maxMembers) {
      return message.reply("❌ Your party is already full or has max pending invites.");
    }

    const mentions = getMentions(message);

    if (mentions.length === 0) {
      return message.reply("❌ Mention a member to invite.");
    }

    const availableSlots = partyConfig.maxMembers - currentCount;

    const newInvites = mentions
      .map((user) => user.id)
      .filter(
        (id) =>
          id !== userId &&
          !(activeParty.members || []).includes(id) &&
          !(activeParty.invited || []).includes(id)
      )
      .slice(0, availableSlots);

    if (newInvites.length === 0) {
      return message.reply("❌ No valid new members to invite.");
    }

    const updatedInvited = [
      ...(activeParty.invited || []),
      ...newInvites,
    ];

    await db.collection("parties").doc(activeParty.id).update({
      invited: updatedInvited,
    });

    return message.reply(
      `📨 Invited: ${newInvites.map((id) => `<@${id}>`).join(", ")}\n\n` +
        `They must join the **Party Queue Voice Channel** and type:\n` +
        `\`!s party accept\``
    );
  }

  if (subCommand === "status") {
    const activeParty = await findUserActiveParty(userId);

    if (!activeParty) {
      return message.reply("❌ You are not in a party.");
    }

    return message.reply(
      `👥 **Party Status**\n\n` +
        `👑 Leader: <@${activeParty.leaderId}>\n` +
        `👥 Members: ${(activeParty.members || []).map((id) => `<@${id}>`).join(", ")}\n` +
        `📨 Invited: ${
          (activeParty.invited || []).length
            ? activeParty.invited.map((id) => `<@${id}>`).join(", ")
            : "None"
        }\n` +
        `📊 Status: **${activeParty.status}**\n` +
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

    const updatedMembers = (activeParty.members || []).filter(
      (id) => id !== userId
    );

    const updatedInvited = (activeParty.invited || []).filter(
      (id) => id !== userId
    );

    await db.collection("parties").doc(activeParty.id).update({
      members: updatedMembers,
      invited: updatedInvited,
    });

    if (activeParty.voiceChannelId) {
      const channel = await message.guild.channels
        .fetch(activeParty.voiceChannelId)
        .catch(() => null);

      if (channel) {
        await channel.permissionOverwrites.delete(userId).catch(() => null);
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

    if (activeParty.voiceChannelId) {
      const channel = await message.guild.channels
        .fetch(activeParty.voiceChannelId)
        .catch(() => null);

      if (channel) {
        await channel.delete().catch(() => null);
      }
    }

    await db.collection("parties").doc(activeParty.id).update({
      status: "disbanded",
      members: [],
      invited: [],
    });

    return message.reply("🛑 Party disbanded.");
  }

  return message.reply("❌ Unknown party command. Use `!s party help`.");
};