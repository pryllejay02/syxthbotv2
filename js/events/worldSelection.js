const { db } = require("../../firebase/firebase");
const worlds = require("../data/worlds");

const GUEST_ROLE_ID = "1507311390455627887";

module.exports = async function worldSelection(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;

    if (!interaction.customId.startsWith("select_world_")) return;

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

    const member = await interaction.guild.members.fetch(userId);

    const newPlayer = {
      userId,
      username: interaction.user.username,

      level: 1,
      exp: 0,
      gold: 500,

      hp: 100,
      maxHp: 100,

      attack: 10,
      defense: 5,

      class: "Novice",
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

      baseStats: {
        attack: 10,
        defense: 5,
        maxHp: 100,
      },

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
        `⚔️ Class: **Novice**\n` +
        `❤️ HP: **100/100**\n` +
        `🪙 Gold: **100**\n\n` +
        `You now have access to your world channels.`,
      components: [],
    });
  } catch (error) {
    console.error("World selection error:", error);

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content: "❌ Something went wrong while selecting your world.",
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: "❌ Something went wrong while selecting your world.",
      ephemeral: true,
    });
  }
};