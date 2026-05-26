const {
  CREATOR_ROLE_ID,
  ADMIN_ROLE_ID,
  ADMIN_CHANNEL_ID,
} = require("../data/adminConfig");

function isAdmin(member) {
  return (
    member.roles.cache.has(CREATOR_ROLE_ID) ||
    member.roles.cache.has(ADMIN_ROLE_ID)
  );
}

function isCreator(member) {
  return member.roles.cache.has(
    CREATOR_ROLE_ID
  );
}

function isAdminChannel(channelId) {
  return channelId === ADMIN_CHANNEL_ID;
}

module.exports = {
  isAdmin,
  isCreator,
  isAdminChannel,
};