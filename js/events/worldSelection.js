const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const worlds = require("../data/worlds");
const classes = require("../data/classes");
const balanceConfig = require("../data/balanceConfig");

const GUEST_ROLE_ID =
  process.env.GUEST_ROLE_ID || "1507311390455627887";

function getStartingGold() {
  return Number(balanceConfig.economy?.startingGold || 500);
}

function cleanRoomName(username, userId) {
  const cleanName = String(username || "player")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  return `${cleanName || "player"}-${String(userId).slice(-4)}-room`;
}

function getStarterWeapon(selectedClassId) {
  const starterWeaponMap = {
    swordsman: {
      name: "Wooden Sword",
      emoji: "🗡️",
    },
    archer: {
      name: "Wooden Bow",
      emoji: "🏹",
    },
    assassin: {
      name: "Training Dagger",
      emoji: "🗡️",
    },
    tanker: {
      name: "Wooden Shield",
      emoji: "🛡️",
    },
  };

  return starterWeaponMap[selectedClassId] || starterWeaponMap.swordsman;
}

function buildBaseStats(selectedClass) {
  const stats = selectedClass.baseStats || {};

  return {
    attack: Number(stats.attack || 10),
    defense: Number(stats.defense || 5),
    maxHp: Number(stats.maxHp || 100),
    dodge: Number(stats.dodge || 0),
    crit: Number(stats.crit || 0),
  };
}

function buildStarterEquipment(selectedClass, starterWeapon) {
  return {
    weapon: {
      id: `${selectedClass.id}_starter_weapon`,
      baseItemId: `${selectedClass.id}_starter_weapon`,

      name: starterWeapon.name,
      type: "Weapon",

      quality: "Starter",
      qualityEmoji: "🌱",

      requiredLevel: 1,
      compatibleClasses: [selectedClass.id],

      price: 0,
      description: "Starter weapon.",

      source: "starter",
      isStarter: true,

      quantity: 1,

      stats: {
        attack: 0,
        defense: 0,
        maxHp: 0,
        dodge: 0,
        crit: 0,
      },

      emoji: starterWeapon.emoji,
    },

    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };
}

async function applyPlayerRoomPermissions(interaction, channel, userId) {
  if (!interaction.guild || !channel || !userId) return false;

  await channel.permissionOverwrites
    .edit(interaction.guild.id, {
      ViewChannel: false,
      SendMessages: false,
      ReadMessageHistory: false,
    })
    .catch(() => null);

  await channel.permissionOverwrites
    .edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    })
    .catch(() => null);

  if (interaction.client?.user?.id) {
    await channel.permissionOverwrites
      .edit(interaction.client.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageChannels: true,
      })
      .catch(() => null);
  }

  return true;
}

async function getOrCreatePlayerRoom(interaction, selectedWorld, userId) {
  const roomName = cleanRoomName(interaction.user.username, userId);

  const existingChannel = interaction.guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name === roomName &&
      channel.parentId === selectedWorld.categoryId
  );

  if (existingChannel) {
    await applyPlayerRoomPermissions(interaction, existingChannel, userId);
    return existingChannel;
  }

  const channel = await interaction.guild.channels.create({
    name: roomName,
    type: ChannelType.GuildText,
    parent: selectedWorld.categoryId,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: userId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ],
    reason: "Syxth MMORPG private player room created.",
  });

  return channel;
}

async function assignRoles(member, selectedWorld) {
  if (!member) return;

  if (GUEST_ROLE_ID) {
    await member.roles.remove(GUEST_ROLE_ID).catch(() => null);
  }

  if (selectedWorld.roleId) {
    await member.roles.add(selectedWorld.roleId).catch(() => null);
  }
}

function buildNewPlayer({
  userId,
  username,
  selectedWorld,
  selectedClass,
  baseStats,
  starterWeapon,
  privateChannelId,
}) {
  const startingGold = getStartingGold();

  return {
    userId,
    username,

    level: 1,
    exp: 0,
    gold: startingGold,

    hp: baseStats.maxHp,
    maxHp: baseStats.maxHp,

    attack: baseStats.attack,
    defense: baseStats.defense,
    dodge: baseStats.dodge,
    crit: baseStats.crit,

    class: selectedClass.name,
    classId: selectedClass.id,
    classEmoji: selectedClass.emoji,

    weapon: starterWeapon.name,

    inventory: [],
    equipment: buildStarterEquipment(selectedClass, starterWeapon),

    baseStats,

    world: {
      id: selectedWorld.id,
      name: selectedWorld.name,
      roleId: selectedWorld.roleId,
    },

    privateChannelId,

    monsterKills: 0,
    retreats: 0,

    reviveAvailableAt: null,
    raidReviveAvailableAt: null,

    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

module.exports = async function worldSelection(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ Character creation must be done inside the server.",
        ephemeral: true,
      });
    }

    if (interaction.customId.startsWith("select_world_")) {
      const userId = interaction.customId.replace("select_world_", "");

      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: "❌ This world selection is not for you.",
          ephemeral: true,
        });
      }

      const selectedWorldId = interaction.values[0];

      const selectedWorld = worlds.find(
        (world) => world.id === selectedWorldId
      );

      if (!selectedWorld) {
        return interaction.reply({
          content: "❌ Invalid world selected.",
          ephemeral: true,
        });
      }

      const playerRef = db.collection("players").doc(userId);
      const playerDoc = await playerRef.get();

      if (playerDoc.exists) {
        return interaction.reply({
          content: "⚔️ You already have a character.",
          ephemeral: true,
        });
      }

      const classMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_class_${userId}_${selectedWorld.id}`)
        .setPlaceholder("⚔️ Select your class")
        .addOptions(
          classes.slice(0, 25).map((playerClass) => ({
            label: playerClass.name,
            description: playerClass.description,
            value: playerClass.id,
            emoji: playerClass.emoji,
          }))
        );

      const row = new ActionRowBuilder().addComponents(classMenu);

      return interaction.update({
        content:
          `🌍 Selected World: **${selectedWorld.name}**\n\n` +
          `Now choose your class to create your character.`,
        components: [row],
      });
    }

    if (interaction.customId.startsWith("select_class_")) {
      const parts = interaction.customId.split("_");

      const userId = parts[2];
      const selectedWorldId = parts.slice(3).join("_");

      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: "❌ This class selection is not for you.",
          ephemeral: true,
        });
      }

      const selectedClassId = interaction.values[0];

      const selectedWorld = worlds.find(
        (world) => world.id === selectedWorldId
      );

      const selectedClass = classes.find(
        (playerClass) => playerClass.id === selectedClassId
      );

      if (!selectedWorld) {
        return interaction.reply({
          content: "❌ Invalid world selected.",
          ephemeral: true,
        });
      }

      if (!selectedClass) {
        return interaction.reply({
          content: "❌ Invalid class selected.",
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();

      const playerRef = db.collection("players").doc(userId);
      const existingPlayerDoc = await playerRef.get();

      if (existingPlayerDoc.exists) {
        return interaction.editReply({
          content: "⚔️ You already have a character.",
          components: [],
        });
      }

      const member = await interaction.guild.members
        .fetch(userId)
        .catch(() => null);

      if (!member) {
        return interaction.editReply({
          content: "❌ Could not find your server member profile.",
          components: [],
        });
      }

      const baseStats = buildBaseStats(selectedClass);
      const starterWeapon = getStarterWeapon(selectedClass.id);

      const playerRoom = await getOrCreatePlayerRoom(
        interaction,
        selectedWorld,
        userId
      );

      const newPlayer = buildNewPlayer({
        userId,
        username: interaction.user.username,
        selectedWorld,
        selectedClass,
        baseStats,
        starterWeapon,
        privateChannelId: playerRoom.id,
      });

      const createResult = await db.runTransaction(async (transaction) => {
        const latestPlayerDoc = await transaction.get(playerRef);

        if (latestPlayerDoc.exists) {
          return {
            ok: false,
            message: "⚔️ You already have a character.",
          };
        }

        transaction.set(playerRef, newPlayer);

        return {
          ok: true,
        };
      });

      if (!createResult.ok) {
        return interaction.editReply({
          content: createResult.message,
          components: [],
        });
      }

      await assignRoles(member, selectedWorld);

      return interaction.editReply({
        content:
          `🔥 Your character has been created!\n\n` +
          `🌍 World: **${selectedWorld.name}**\n` +
          `${selectedClass.emoji} Class: **${selectedClass.name}**\n\n` +
          `🗡️ Starter Weapon: **${starterWeapon.name}**\n` +
          `❤️ HP: **${newPlayer.hp}/${newPlayer.maxHp}**\n` +
          `⚔️ Attack: **${newPlayer.attack}**\n` +
          `🛡️ Defense: **${newPlayer.defense}**\n` +
          `💨 Dodge: **${newPlayer.dodge}%**\n` +
          `💥 Crit: **${newPlayer.crit}%**\n` +
          `🪙 Gold: **${newPlayer.gold}**\n\n` +
          `🏠 Private Room: <#${playerRoom.id}>\n\n` +
          `Only you and the bot can access this room.`,
        components: [],
      });
    }
  } catch (error) {
    console.error("World/Class selection error:", error);

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content: "❌ Something went wrong while creating your character.",
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: "❌ Something went wrong while creating your character.",
      ephemeral: true,
    });
  }
};