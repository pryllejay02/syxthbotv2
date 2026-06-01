const {
  CREATOR_ROLE_ID,
  ADMIN_ROLE_ID,
  ADMIN_CHANNEL_ID,
} = require("../data/adminConfig");

function hasRole(member, roleId) {
  if (!member || !roleId) return false;

  return member.roles?.cache?.has(roleId) || false;
}

function isCreator(member) {
  return hasRole(member, CREATOR_ROLE_ID);
}

function isAdmin(member) {
  return isCreator(member) || hasRole(member, ADMIN_ROLE_ID);
}

function isAdminChannel(channelId) {
  if (!channelId || !ADMIN_CHANNEL_ID) return false;

  return String(channelId) === String(ADMIN_CHANNEL_ID);
}

module.exports = {
  hasRole,
  isCreator,
  isAdmin,
  isAdminChannel,
};