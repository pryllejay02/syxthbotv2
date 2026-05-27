const {
  CREATOR_ROLE_ID,
  ADMIN_ROLE_ID,
  ADMIN_CHANNEL_ID,
} = require("../data/adminConfig");

function isCreator(member) {
  return member.roles.cache.has(
    CREATOR_ROLE_ID
  );
}

function isAdmin(member) {
  return (
    isCreator(member) ||
    member.roles.cache.has(
      ADMIN_ROLE_ID
    )
  );
}

function isAdminChannel(channelId) {
  return channelId === ADMIN_CHANNEL_ID;
}

module.exports = {
  isCreator,
  isAdmin,
  isAdminChannel,
};