const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const worlds = require("../data/worlds");
const classes = require("../data/classes");

const GUEST_ROLE_ID = "1507311390455627887";

module.exports = async function worldSelection(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;

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
          classes.map((playerClass) => ({
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

      const playerRef = db.collection("players").doc(userId);
      const playerDoc = await playerRef.get();

      if (playerDoc.exists) {
        return interaction.reply({
          content: "⚔️ You already have a character.",
          ephemeral: true,
        });
      }

      const member = await interaction.guild.members.fetch(userId);

      const baseStats = {
        attack: selectedClass.baseStats.attack,
        defense: selectedClass.baseStats.defense,
        maxHp: selectedClass.baseStats.maxHp,
        dodge: selectedClass.baseStats.dodge,
        crit: selectedClass.baseStats.crit,
      };

      const newPlayer = {
        userId,
        username: interaction.user.username,

        level: 1,
        exp: 0,
        gold: 500,

        hp: baseStats.maxHp,
        maxHp: baseStats.maxHp,

        attack: baseStats.attack,
        defense: baseStats.defense,
        dodge: baseStats.dodge,
        crit: baseStats.crit,

        class: selectedClass.name,
        classId: selectedClass.id,
        classEmoji: selectedClass.emoji,

        weapon: "Wooden Sword",

        inventory: [],

        equipment: {
          weapon: null,
          helmet: null,
          armor: null,
          gloves: null,
          pants: null,
          boots: null,
        },

        baseStats,

        world: {
          id: selectedWorld.id,
          name: selectedWorld.name,
          roleId: selectedWorld.roleId,
        },

        createdAt: new Date(),
      };

      await playerRef.set(newPlayer);

      if (GUEST_ROLE_ID) {
        await member.roles.remove(GUEST_ROLE_ID).catch(() => {});
      }

      await member.roles.add(selectedWorld.roleId);

      return interaction.update({
        content:
          `🔥 Your character has been created!\n\n` +
          `🌍 World: **${selectedWorld.name}**\n` +
          `${selectedClass.emoji} Class: **${selectedClass.name}**\n\n` +
          `❤️ HP: **${newPlayer.hp}/${newPlayer.maxHp}**\n` +
          `⚔️ Attack: **${newPlayer.attack}**\n` +
          `🛡️ Defense: **${newPlayer.defense}**\n` +
          `💨 Dodge: **${newPlayer.dodge}%**\n` +
          `💥 Crit: **${newPlayer.crit}%**\n` +
          `🪙 Gold: **${newPlayer.gold}**\n\n` +
          `You now have access to your world channels.`,
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