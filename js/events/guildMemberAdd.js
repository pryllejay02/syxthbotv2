const GUEST_ROLE_ID =
  process.env.GUEST_ROLE_ID || "1507311390455627887";

const SERVER_SELECTION_CHANNEL_ID =
  process.env.SERVER_SELECTION_CHANNEL_ID || "1507254912009113731";

async function safeAddRole(member, roleId) {
  if (!member || !roleId) {
    return {
      ok: false,
      reason: "Missing member or role ID.",
    };
  }

  const role = member.guild.roles.cache.get(roleId);

  if (!role) {
    return {
      ok: false,
      reason: `Guest role not found: ${roleId}`,
    };
  }

  if (member.roles.cache.has(roleId)) {
    return {
      ok: true,
      added: false,
      reason: "Member already has the guest role.",
    };
  }

  await member.roles.add(role).catch((error) => {
    console.error("Failed to add guest role:", error);
    throw error;
  });

  return {
    ok: true,
    added: true,
    role,
  };
}

async function safeSendWelcome(member, channelId) {
  if (!member || !channelId) {
    return {
      ok: false,
      reason: "Missing member or channel ID.",
    };
  }

  const channel = await member.guild.channels
    .fetch(channelId)
    .catch(() => null);

  if (!channel) {
    return {
      ok: false,
      reason: `Server selection channel not found: ${channelId}`,
    };
  }

  if (!channel.isTextBased?.()) {
    return {
      ok: false,
      reason: `Server selection channel is not text-based: ${channelId}`,
    };
  }

  await channel
    .send(
      `👋 Welcome <@${member.id}> to **SYXTH MMORPG**!\n\n` +
        `To begin your adventure, type:\n` +
        `\`!s start\`\n\n` +
        `Then choose your world and class.`
    )
    .catch((error) => {
      console.error("Failed to send welcome message:", error);
      throw error;
    });

  return {
    ok: true,
    channel,
  };
}

module.exports = async function guildMemberAdd(member) {
  try {
    if (!member || member.user?.bot) return;

    const roleResult = await safeAddRole(member, GUEST_ROLE_ID).catch(
      (error) => ({
        ok: false,
        reason: error.message,
      })
    );

    if (roleResult.ok && roleResult.added) {
      console.log(`Guest role added to ${member.user.tag}`);
    } else if (roleResult.ok && !roleResult.added) {
      console.log(`${member.user.tag} already has the guest role.`);
    } else {
      console.warn(roleResult.reason);
    }

    const welcomeResult = await safeSendWelcome(
      member,
      SERVER_SELECTION_CHANNEL_ID
    ).catch((error) => ({
      ok: false,
      reason: error.message,
    }));

    if (welcomeResult.ok) {
      console.log(`Welcome message sent for ${member.user.tag}`);
    } else {
      console.warn(welcomeResult.reason);
    }
  } catch (error) {
    console.error("guildMemberAdd error:", error);
  }
};