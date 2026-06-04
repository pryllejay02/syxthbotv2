const {
  isAdmin,
  isAdminChannel,
} = require("../utils/adminUtils");

const adminHelp = require("../admin/adminHelp");
const adminItems = require("../admin/adminItems");
const adminPlayer = require("../admin/adminPlayer");
const adminBoss = require("../admin/adminBoss");
const adminReset = require("../admin/adminReset");
const adminRoom = require("../admin/adminRoom");
const adminMaintenance = require("../admin/adminMaintenance");

const ITEM_ADMIN_COMMANDS = new Set([
  "giveitem",
  "givebossitem",
  "givepet",
]);

const PLAYER_ADMIN_COMMANDS = new Set([
  "givegold",
  "setlevel",
  "heal",
  "revive",
  "inventory",
]);

const MAINTENANCE_ADMIN_COMMANDS = new Set([
  "repairplayer",
]);

const BOSS_ADMIN_COMMANDS = new Set([
  "summonboss",
  "removeboss",
]);

const ROOM_ADMIN_COMMANDS = new Set([
  "repairroom",
]);

const RESET_ADMIN_COMMANDS = new Set([
  "resettrade",
  "resetparty",
  "resetbattle",
  "resetall",
]);

module.exports = async function adminCommand(message, args = []) {
  if (!isAdmin(message.member)) {
    return message.reply("❌ Only Divine Gods can use this command.");
  }

  if (!isAdminChannel(message.channel.id)) {
    return message.reply(
      "❌ This command can only be used in the admin channel."
    );
  }

  const subCommand = String(args[0] || "").toLowerCase();

  if (!subCommand || subCommand === "help") {
    return adminHelp(message);
  }

  if (ITEM_ADMIN_COMMANDS.has(subCommand)) {
    return adminItems(message, args);
  }

  if (PLAYER_ADMIN_COMMANDS.has(subCommand)) {
    return adminPlayer(message, args);
  }

  if (MAINTENANCE_ADMIN_COMMANDS.has(subCommand)) {
    return adminMaintenance(message, args);
  }

  if (BOSS_ADMIN_COMMANDS.has(subCommand)) {
    return adminBoss(message, args);
  }

  if (ROOM_ADMIN_COMMANDS.has(subCommand)) {
    return adminRoom(message, args);
  }

  if (RESET_ADMIN_COMMANDS.has(subCommand)) {
    return adminReset(message, args);
  }

  return message.reply(
    "❌ Unknown admin command.\n\n" +
      "Use `!s admin help` to view available admin commands."
  );
};