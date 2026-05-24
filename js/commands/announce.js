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
        "`!s announce <world_id/all> <message>`\n\n" +
        "Example:\n" +
        "`!s announce world_1 Server maintenance in 10 minutes.`\n" +
        "`!s announce all Server update is now live.`"
    );
  }

  const targetWorlds =
    worldId.toLowerCase() === "all"
      ? worlds
      : worlds.filter(
          (w) => w.id.toLowerCase() === worldId.toLowerCase()
        );

  if (targetWorlds.length === 0) {
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

  let notificationSent = 0;
  let notificationFailed = 0;
  let privateRoomSent = 0;
  let privateRoomFailed = 0;

  for (const world of targetWorlds) {
    const notificationChannel = await message.guild.channels
      .fetch(world.notificationChannelId)
      .catch(() => null);

    if (notificationChannel) {
      await notificationChannel
        .send({
          content: `<@&${world.roleId}>`,
          embeds: [embed],
          allowedMentions: {
            roles: [world.roleId],
          },
        })
        .then(() => {
          notificationSent++;
        })
        .catch(() => {
          notificationFailed++;
        });
    } else {
      notificationFailed++;
    }

    const playersSnapshot = await db
      .collection("players")
      .where("world.id", "==", world.id)
      .get();

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
  }

  const targetName =
    worldId.toLowerCase() === "all"
      ? "All Worlds"
      : targetWorlds[0].name;

  return message.reply(
    `✅ Divine announcement sent to **${targetName}**.\n\n` +
      `📢 Notification Channels Sent: **${notificationSent}**\n` +
      `⚠️ Notification Channels Failed: **${notificationFailed}**\n` +
      `🏠 Private Rooms Sent: **${privateRoomSent}**\n` +
      `⚠️ Private Rooms Failed: **${privateRoomFailed}**`
  );
};