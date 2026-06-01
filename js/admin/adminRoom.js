const {
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const worlds = require("../data/worlds");

function getMention(message) {
  return message.mentions.users.first();
}

function cleanRoomName(username, userId) {
  const cleanName = String(username || "player")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  return `${cleanName || "player"}-${userId.slice(-4)}-room`;
}

function getWorldById(worldId) {
  return worlds.find((world) => world.id === worldId) || null;
}

async function applyRoomPermissions(message, channel, targetUserId) {
  if (!message.guild || !channel || !targetUserId) {
    return false;
  }

  await channel.permissionOverwrites
    .edit(message.guild.id, {
      ViewChannel: false,
      SendMessages: false,
      ReadMessageHistory: false,
    })
    .catch(() => null);

  await channel.permissionOverwrites
    .edit(targetUserId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    })
    .catch(() => null);

  if (message.client?.user?.id) {
    await channel.permissionOverwrites
      .edit(message.client.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageChannels: true,
      })
      .catch(() => null);
  }

  return true;
}

async function findExistingRoom(message, roomName, categoryId, userId) {
  if (!message.guild || !categoryId || !userId) {
    return null;
  }

  const byExactName = message.guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name === roomName &&
      channel.parentId === categoryId
  );

  if (byExactName) {
    return byExactName;
  }

  const byUserPermission = message.guild.channels.cache.filter(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.parentId === categoryId &&
      channel.permissionOverwrites.cache.has(userId)
  );

  return byUserPermission.first() || null;
}

async function createPlayerRoom(message, player, targetUser, selectedWorld) {
  const roomName = cleanRoomName(
    player.username || targetUser.username,
    targetUser.id
  );

  const existingRoom = await findExistingRoom(
    message,
    roomName,
    selectedWorld.categoryId,
    targetUser.id
  );

  if (existingRoom) {
    await applyRoomPermissions(message, existingRoom, targetUser.id);

    return {
      room: existingRoom,
      created: false,
    };
  }

  const room = await message.guild.channels.create({
    name: roomName,
    type: ChannelType.GuildText,
    parent: selectedWorld.categoryId,
    permissionOverwrites: [
      {
        id: message.guild.id,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: targetUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: message.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ],
    reason: "Syxth MMORPG player room repair.",
  });

  return {
    room,
    created: true,
  };
}

module.exports = async function adminRoom(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (subCommand !== "repairroom") {
    return message.reply(
      "❌ Unknown room admin command.\n\n" +
        "Available:\n" +
        "`!s admin repairroom @player`"
    );
  }

  if (!message.guild) {
    return message.reply("❌ This command can only be used inside a server.");
  }

  if (!target || target.bot) {
    return message.reply("❌ Usage: `!s admin repairroom @player`");
  }

  const playerRef = db.collection("players").doc(target.id);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("❌ Character not found.");
  }

  const player = playerDoc.data();
  const worldId = player.world?.id;

  if (!worldId) {
    return message.reply(
      `❌ **${player.username || target.username}** has no selected world in their player data.`
    );
  }

  const selectedWorld = getWorldById(worldId);

  if (!selectedWorld) {
    return message.reply(
      `❌ World config not found for world ID: **${worldId}**.`
    );
  }

  if (!selectedWorld.categoryId) {
    return message.reply(
      `❌ World category ID is missing for **${selectedWorld.name || worldId}**.`
    );
  }

  const category = await message.guild.channels
    .fetch(selectedWorld.categoryId)
    .catch(() => null);

  if (!category) {
    return message.reply(
      `❌ Category channel not found for **${selectedWorld.name || worldId}**.\n\n` +
        `Category ID: \`${selectedWorld.categoryId}\``
    );
  }

  const currentPrivateChannelId = player.privateChannelId;

  if (currentPrivateChannelId) {
    const currentChannel = await message.guild.channels
      .fetch(currentPrivateChannelId)
      .catch(() => null);

    if (currentChannel) {
      await applyRoomPermissions(message, currentChannel, target.id);

      await playerRef.update({
        privateChannelId: currentChannel.id,
        updatedAt: new Date(),
      });

      return message.reply(
        `✅ **${player.username || target.username}** already has a valid private room.\n\n` +
          `🏠 Room: <#${currentChannel.id}>\n` +
          `🌍 World: **${selectedWorld.name || worldId}**\n` +
          `📌 Action: **Permissions repaired**`
      );
    }
  }

  const result = await createPlayerRoom(
    message,
    player,
    target,
    selectedWorld
  );

  await playerRef.update({
    privateChannelId: result.room.id,
    updatedAt: new Date(),
  });

  return message.reply(
    `✅ Private room repaired for **${player.username || target.username}**.\n\n` +
      `🏠 Room: <#${result.room.id}>\n` +
      `🌍 World: **${selectedWorld.name || worldId}**\n` +
      `📌 Action: **${result.created ? "Created new room" : "Reused existing room"}**`
  );
};