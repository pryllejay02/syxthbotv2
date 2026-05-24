const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const { db } = require("../../firebase/firebase");
const worlds = require("../data/worlds");

// ADMIN ANNOUNCEMENT CHANNEL
const ANNOUNCE_CHANNEL_ID = "1507540792506454076";

module.exports = async function announceCommand(message, args = []) {
  if (message.channel.id !== ANNOUNCE_CHANNEL_ID) {
    return message.reply(
      "❌ You can only use this command in the announcement channel."
    );
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ Only admins can use this command.");
  }

  const worldId = args[0];
  const announcement = args.slice(1).join(" ");

  if (!worldId || !announcement) {
    return message.reply(
      "❌ Usage:\n" +
        "`!s announce <world_id> <message>`\n\n" +
        "Example:\n" +
        "`!s announce world_1 Server maintenance in 10 minutes.`"
    );
  }

  const world = worlds.find(
    (w) => w.id.toLowerCase() === worldId.toLowerCase()
  );

  if (!world) {
    return message.reply("❌ World not found.");
  }

  const embed = new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("⚜️ SYXTH WORLD ANNOUNCEMENT ⚜️")
    .setDescription(
      `> 📜 **Message from the Divine Gods**\n\n` +
        `## ${announcement.toUpperCase()}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ **Stay alert, adventurers.**`
    )
    .setThumbnail(message.guild.iconURL({ dynamic: true }))
    .setFooter({
      text: "Syxth MMORPG • Divine Gods Notification",
    })
    .setTimestamp();

  // Send to world notification channel
  const notificationChannel = await message.guild.channels
    .fetch(world.notificationChannelId)
    .catch(() => null);

  if (notificationChannel) {
    await notificationChannel.send({
      content: `<@&${world.roleId}>`,
      embeds: [embed],
      allowedMentions: {
        roles: [world.roleId],
      },
    });
  }

  // Send to players' private rooms in this world
  const playersSnapshot = await db
    .collection("players")
    .where("world.id", "==", world.id)
    .get();

  let privateRoomSent = 0;
  let privateRoomFailed = 0;

  for (const doc of playersSnapshot.docs) {
    const player = doc.data();

    if (!player.privateChannelId) {
      privateRoomFailed++;
      continue;
    }

    const privateChannel = await message.guild.channels
      .fetch(player.privateChannelId)
      .catch(() => null);

    if (!privateChannel) {
      privateRoomFailed++;
      continue;
    }

    await privateChannel
      .send({
        embeds: [embed],
      })
      .then(() => {
        privateRoomSent++;
      })
      .catch(() => {
        privateRoomFailed++;
      });
  }

  return message.reply(
    `✅ Divine announcement sent to **${world.name}**.\n\n` +
      `📢 Notification Channel: ${notificationChannel ? "Sent" : "Not Found"}\n` +
      `🏠 Private Rooms Sent: **${privateRoomSent}**\n` +
      `⚠️ Private Rooms Failed: **${privateRoomFailed}**`
  );
};