const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const worlds = require("../data/worlds");

// SERVER SELECTION CHANNEL ID
const SERVER_SELECTION_CHANNEL_ID = "1507254912009113731";

module.exports = async function startCommand(message) {
  // ONLY ALLOW IN SERVER-SELECTION CHANNEL
  if (message.channel.id !== SERVER_SELECTION_CHANNEL_ID) {
    return message.reply(
      "❌ You can only create your character in the server-selection channel."
    );
  }

  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (playerDoc.exists) {
    return message.reply(
      "⚔️ You already have a Syxth character!"
    );
  }

  // CREATE WORLD SELECTION MENU
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_world_${userId}`)
    .setPlaceholder("🌍 Select your world")
    .addOptions(
      worlds.map((world) => ({
        label: world.name,
        description: world.description,
        value: world.id,
      }))
    );

  const row = new ActionRowBuilder().addComponents(menu);

  return message.reply({
    content:
      "🌍 **Choose your world to create your character.**\n\n" +
      "Your selected world will determine which channels you can access.",
    components: [row],
  });
};