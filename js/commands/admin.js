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

module.exports = async function adminCommand(message, args = []) {
  if (!isAdmin(message.member)) {
    return message.reply("❌ Only Divine Gods can use this command.");
  }

  if (!isAdminChannel(message.channel.id)) {
    return message.reply("❌ This command can only be used in the admin channel.");
  }

  const subCommand = String(args[0] || "").toLowerCase();

  if (!subCommand || subCommand === "help") {
    return adminHelp(message);
  }

  if (["giveitem", "givebossitem"].includes(subCommand)) {
    return adminItems(message, args);
  }

  if (
    ["givegold", "setlevel", "heal", "revive", "inventory"].includes(
      subCommand
    )
  ) {
    return adminPlayer(message, args);
  }

  if (["summonboss", "removeboss"].includes(subCommand)) {
    return adminBoss(message, args);
  }

  if (["repairroom"].includes(subCommand)) {
    return adminRoom(message, args);
  }

  if (["repairplayer"].includes(subCommand)) {
    return adminMaintenance(message, args);
  }

  if (
    ["resettrade", "resetparty", "resetbattle", "resetall"].includes(
      subCommand
    )
  ) {
    return adminReset(message, args);
  }

  return message.reply(
    "❌ Unknown admin command. Use `!s admin help`."
  );
};