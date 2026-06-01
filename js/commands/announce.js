const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const { db } = require("../../firebase/firebase");
const worlds = require("../data/worlds");

// ADMIN ANNOUNCEMENT CHANNEL
const ANNOUNCE_CHANNEL_ID = "1507540792506454076";

function getTargetWorlds(worldId) {
  const normalizedWorldId = String(worldId || "").toLowerCase();

  if (normalizedWorldId === "all") {
    return worlds;
  }

  return worlds.filter(
    (world) => String(world.id || "").toLowerCase() === normalizedWorldId
  );
}

function trimText(text, maxLength = 3500) {
  const value = String(text || "").trim();

  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 3) + "...";
}

function buildAnnouncementEmbed(message, announcement) {
  const safeAnnouncement = trimText(announcement, 3200);

  return new EmbedBuilder()
    .setColor("#8B0000")
    .setTitle("⚜️ SYXTH WORLD ANNOUNCEMENT ⚜️")
    .setDescription(
      `> 📜 **Message from the Divine Gods**\n\n` +
        `## ${safeAnnouncement.toUpperCase()}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ **Stay alert, adventurers.**`
    )
    .setThumbnail(
      message.guild?.iconURL({
        dynamic: true,
      }) || null
    )
    .setFooter({
      text: "Syxth MMORPG • Divine Gods Notification",
    })
    .setTimestamp();
}

async function sendToNotificationChannel(message, world, embed) {
  if (!world.notificationChannelId) {
    return false;
  }

  const notificationChannel = await message.guild.channels
    .fetch(world.notificationChannelId)
    .catch(() => null);

  if (!notificationChannel) {
    return false;
  }

  const payload = {
    embeds: [embed],
  };

  if (world.roleId) {
    payload.content = `<@&${world.roleId}>`;
    payload.allowedMentions = {
      roles: [world.roleId],
    };
  }

  await notificationChannel.send(payload);

  return true;
}

async function sendToPrivateRooms(message, world, embed) {
  let sent = 0;
  let failed = 0;

  const playersSnapshot = await db
    .collection("players")
    .where("world.id", "==", world.id)
    .get();

  for (const doc of playersSnapshot.docs) {
    const player = doc.data();

    if (!player.privateChannelId) {
      failed++;
      continue;
    }

    const privateChannel = await message.guild.channels
      .fetch(player.privateChannelId)
      .catch(() => null);

    if (!privateChannel) {
      failed++;
      continue;
    }

    await privateChannel
      .send({
        embeds: [embed],
      })
      .then(() => {
        sent++;
      })
      .catch(() => {
        failed++;
      });
  }

  return {
    sent,
    failed,
  };
}

module.exports = async function announceCommand(message, args = []) {
  if (!message.guild) {
    return message.reply("❌ This command can only be used inside a server.");
  }

  if (message.channel.id !== ANNOUNCE_CHANNEL_ID) {
    return message.reply(
      "❌ You can only use this command in the announcement channel."
    );
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ Only admins can use this command.");
  }

  const worldId = String(args[0] || "").toLowerCase();
  const announcement = args.slice(1).join(" ").trim();

  if (!worldId || !announcement) {
    return message.reply(
      "❌ Usage:\n" +
        "`!s announce <world_id/all> <message>`\n\n" +
        "Examples:\n" +
        "`!s announce world_1 Server maintenance in 10 minutes.`\n" +
        "`!s announce all Server update is now live.`"
    );
  }

  const targetWorlds = getTargetWorlds(worldId);

  if (targetWorlds.length === 0) {
    return message.reply("❌ World not found.");
  }

  const embed = buildAnnouncementEmbed(message, announcement);

  let notificationSent = 0;
  let notificationFailed = 0;
  let privateRoomSent = 0;
  let privateRoomFailed = 0;

  for (const world of targetWorlds) {
    const notificationSuccess = await sendToNotificationChannel(
      message,
      world,
      embed
    ).catch(() => false);

    if (notificationSuccess) {
      notificationSent++;
    } else {
      notificationFailed++;
    }

    const privateRoomResult = await sendToPrivateRooms(
      message,
      world,
      embed
    ).catch(() => ({
      sent: 0,
      failed: 1,
    }));

    privateRoomSent += privateRoomResult.sent;
    privateRoomFailed += privateRoomResult.failed;
  }

  const targetName =
    worldId === "all"
      ? "All Worlds"
      : targetWorlds[0].name || targetWorlds[0].id;

  return message.reply(
    `✅ Divine announcement sent to **${targetName}**.\n\n` +
      `📢 Notification Channels Sent: **${notificationSent}**\n` +
      `⚠️ Notification Channels Failed: **${notificationFailed}**\n` +
      `🏠 Private Rooms Sent: **${privateRoomSent}**\n` +
      `⚠️ Private Rooms Failed: **${privateRoomFailed}**`
  );
};