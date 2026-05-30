const GUEST_ROLE_ID = "1507311390455627887";
const SERVER_SELECTION_CHANNEL_ID = "1507254912009113731";

module.exports = async function guildMemberAdd(member) {
  try {
    if (!member || member.user.bot) return;

    const guestRole = member.guild.roles.cache.get(GUEST_ROLE_ID);

    if (guestRole) {
      await member.roles.add(guestRole).catch((error) => {
        console.error("Failed to add guest role:", error);
      });

      console.log(`Guest role added to ${member.user.tag}`);
    } else {
      console.warn(`Guest role not found: ${GUEST_ROLE_ID}`);
    }

    const selectionChannel = member.guild.channels.cache.get(
      SERVER_SELECTION_CHANNEL_ID
    );

    if (selectionChannel) {
      await selectionChannel
        .send(
          `👋 Welcome <@${member.id}> to **SYXTH MMORPG**!\n\n` +
            `To begin your adventure, type:\n` +
            `\`!s start\`\n\n` +
            `Then choose your world and class.`
        )
        .catch((error) => {
          console.error("Failed to send welcome message:", error);
        });
    } else {
      console.warn(
        `Server selection channel not found: ${SERVER_SELECTION_CHANNEL_ID}`
      );
    }
  } catch (error) {
    console.error("guildMemberAdd error:", error);
  }
};