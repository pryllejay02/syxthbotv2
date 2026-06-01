const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const worlds = require("../data/worlds");
const balanceConfig = require("../data/balanceConfig");

// SERVER SELECTION CHANNEL ID
const SERVER_SELECTION_CHANNEL_ID = "1507254912009113731";

function getStartingGold() {
  return Number(balanceConfig.economy?.startingGold || 500);
}

function buildWorldOptions() {
  if (!Array.isArray(worlds)) return [];

  return worlds.slice(0, 25).map((world) => ({
    label: world.name || world.id || "Unknown World",
    description: world.description || `Enter ${world.name || world.id}`,
    value: world.id,
    emoji: world.emoji || "🌍",
  }));
}

function getExistingCharacterReply(player, username) {
  const roomText = player.privateChannelId
    ? `<#${player.privateChannelId}>`
    : "No private room found. Please contact an admin.";

  return (
    `⚔️ You already have a Syxth character!\n\n` +
    `👤 Character: **${player.username || username}**\n` +
    `🌍 World: **${player.world?.name || "Unknown"}**\n` +
    `🎭 Class: **${player.class || "Unknown"}**\n` +
    `⭐ Level: **${player.level || 1}**\n` +
    `🏠 Private Room: ${roomText}\n\n` +
    `Use \`!s profile\` inside your private room.`
  );
}

module.exports = async function startCommand(message) {
  if (!message.guild) {
    return message.reply("❌ You can only create a character inside the server.");
  }

  if (message.channel.id !== SERVER_SELECTION_CHANNEL_ID) {
    return message.reply(
      `❌ You can only create your character in <#${SERVER_SELECTION_CHANNEL_ID}>.`
    );
  }

  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (playerDoc.exists) {
    const player = playerDoc.data();

    return message.reply(
      getExistingCharacterReply(player, message.author.username)
    );
  }

  if (!Array.isArray(worlds) || worlds.length === 0) {
    return message.reply(
      "❌ No worlds are currently available. Please contact an admin."
    );
  }

  const worldOptions = buildWorldOptions();

  if (worldOptions.length === 0) {
    return message.reply(
      "❌ No valid world options are currently available. Please contact an admin."
    );
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_world_${userId}`)
    .setPlaceholder("🌍 Select your world")
    .addOptions(worldOptions);

  const row = new ActionRowBuilder().addComponents(menu);

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("⚔️ WELCOME TO SYXTH MMORPG")
    .setDescription(
      `🌍 **Choose your world first.**\n\n` +
        `After choosing your world, you will select your class:\n` +
        `⚔️ Swordsman • 🏹 Archer • 🗡️ Assassin • 🛡️ Tanker\n\n` +
        `Your character will receive:\n` +
        `🗡️ Starter weapon\n` +
        `🪙 ${getStartingGold()} Gold\n` +
        `🏠 Private MMORPG room\n\n` +
        `Only **${message.author.username}** can use this selection menu.`
    )
    .setThumbnail(
      message.author.displayAvatarURL({
        dynamic: true,
      })
    )
    .setFooter({
      text: "Syxth MMORPG • Character Creation",
    });

  return message.reply({
    embeds: [embed],
    components: [row],
  });
};