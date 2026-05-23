const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const worlds = require("../data/worlds");

// ADMIN ANNOUNCEMENT CHANNEL
const ANNOUNCE_CHANNEL_ID = "1507540792506454076";

module.exports = async function announceCommand(message, args = []) {

  // =========================
  // CHANNEL RESTRICTION
  // =========================
  if (message.channel.id !== ANNOUNCE_CHANNEL_ID) {
    return message.reply(
      "❌ You can only use this command in the announcement channel."
    );
  }

  // =========================
  // ADMIN CHECK
  // =========================
  if (
    !message.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) {
    return message.reply(
      "❌ Only admins can use this command."
    );
  }

  const worldId = args[0];
  const announcement = args.slice(1).join(" ");

  // =========================
  // VALIDATION
  // =========================
  if (!worldId || !announcement) {
    return message.reply(
      "❌ Usage:\n" +
      "`!s announce <world_id> <message>`\n\n" +
      "Example:\n" +
      "`!s announce syxth_realm Server maintenance in 10 minutes.`"
    );
  }

  // =========================
  // FIND WORLD
  // =========================
  const world = worlds.find(
    (w) =>
      w.id.toLowerCase() ===
      worldId.toLowerCase()
  );

  if (!world) {
    return message.reply(
      "❌ World not found."
    );
  }

  // =========================
  // FETCH CHANNEL
  // =========================
  const channel = await message.guild.channels
    .fetch(world.notificationChannelId)
    .catch(() => null);

  if (!channel) {
    return message.reply(
      "❌ Notification channel not found."
    );
  }

  // =========================
  // EMBED UI
  // =========================
  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("⚜️ SYXTH WORLD ANNOUNCEMENT ⚜️")
    .setDescription(
      `> 📜 **Message from the Divine Gods**\n\n` +

      `## ${announcement.toUpperCase()}\n\n` +

      `━━━━━━━━━━━━━━━━━━\n` +
      `⚔️ **Stay alert, adventurers.**`
    )
    .setThumbnail(
      message.guild.iconURL({
        dynamic: true,
      })
    )
    .setFooter({
      text:
        "Syxth MMORPG • Divine Gods Notification",
    })
    .setTimestamp();

  // =========================
  // SEND ANNOUNCEMENT
  // =========================
  await channel.send({
    content: `<@&${world.roleId}>`,
    embeds: [embed],
    allowedMentions: {
      roles: [world.roleId],
    },
  });

  return message.reply(
    `✅ Divine announcement sent to **${world.name}**.`
  );
};