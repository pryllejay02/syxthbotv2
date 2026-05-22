const GUEST_ROLE_ID = "1507311390455627887";

module.exports = async function guildMemberAdd(member) {
  try {
    const guestRole = member.guild.roles.cache.get(GUEST_ROLE_ID);

    if (!guestRole) {
      console.log("Guest role not found.");
      return;
    }

    await member.roles.add(guestRole);

    console.log(`Guest role added to ${member.user.tag}`);
  } catch (error) {
    console.error("Error adding guest role:", error);
  }
};