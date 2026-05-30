const { db } = require("../../firebase/firebase");

const startCommand = require("../commands/start");
const profileCommand = require("../commands/profile");
const huntCommand = require("../commands/hunt");
const helpCommand = require("../commands/help");
const restCommand = require("../commands/rest");
const hitCommand = require("../commands/hit");
const retreatCommand = require("../commands/retreat");
const inventoryCommand = require("../commands/inventory");
const shopCommand = require("../commands/shop");
const buyCommand = require("../commands/buy");
const useCommand = require("../commands/use");
const characterCommand = require("../commands/character");
const equipCommand = require("../commands/equip");
const unequipCommand = require("../commands/unequip");
const announceCommand = require("../commands/announce");
const sellCommand = require("../commands/sell");
const leaderboardCommand = require("../commands/leaderboard");
const partyCommand = require("../commands/party");
const raidCommand = require("../commands/raid");
const tradeCommand = require("../commands/trade");
const flexCommand = require("../commands/flex");
const adminCommand = require("../commands/admin");
const creatorAutoCommand = require("../admin/autoplay");

const { checkCooldown, formatCooldown } = require("../utils/cooldownSystem");
const { resolvePlayerRevive } = require("../utils/reviveSystem");

const COMMAND_COOLDOWNS = {
  hunt: 3000,
  hit: 1800,
  rest: 3000,
  buy: 1500,
  sell: 1500,
  use: 1500,
  equip: 1500,
  unequip: 1500,
  inventory: 2500,
  inv: 2500,
  profile: 2500,
  character: 2500,
  char: 2500,
  leaderboard: 5000,
  lb: 5000,
  flex: 3000,
  trade: 1500,
  party: 1500,
  raid: 2500,
};

function getCooldownAction(command, args) {
  if (command === "raid") return `raid:${String(args[0] || "status").toLowerCase()}`;
  if (command === "trade") return `trade:${String(args[0] || "invite").toLowerCase()}`;
  if (command === "party") return `party:${String(args[0] || "help").toLowerCase()}`;
  return command;
}

module.exports = async function commandHandler(client, message, prefix) {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    if (command === "ping") {
      const sent = await message.reply("🏓 Checking ping...");

      const wsPing =
        client.ws.ping === -1 ? "Still calculating..." : `${client.ws.ping}ms`;

      return sent.edit(
        `🏓 Pong!\n` +
          `🌐 WebSocket Ping: ${wsPing}\n` +
          `⚡ Message Latency: ${
            sent.createdTimestamp - message.createdTimestamp
          }ms`
      );
    }

    const publicCommands = [
      "start",
      "help",
      "ping",
      "announce",
      "party",
      "raid",
      "trade",
      "flex",
      "admin",
      "creator",
    ];

    if (!publicCommands.includes(command)) {
      const playerRef = db.collection("players").doc(message.author.id);
      const playerDoc = await playerRef.get();

      if (!playerDoc.exists) {
        return message.reply(
          "❌ You don’t have a character yet. Use `!s start` first."
        );
      }

      const player = playerDoc.data();
      const privateChannelId = player.privateChannelId;

      if (!privateChannelId) {
        return message.reply(
          "❌ You don’t have a private room yet. Please contact an admin or recreate your character."
        );
      }

      if (message.channel.id !== privateChannelId) {
        return message.reply(
          `❌ Please use your MMORPG commands inside your private room: <#${privateChannelId}>`
        );
      }

      // Recover players whose revive timer became ready while the bot was offline/restarted.
      await resolvePlayerRevive(playerRef, player);
    }

    const cooldownMs = COMMAND_COOLDOWNS[command] || 0;

    if (cooldownMs > 0) {
      const cooldown = checkCooldown(
        message.author.id,
        getCooldownAction(command, args),
        cooldownMs
      );

      if (!cooldown.allowed) {
        return message.reply(
          `⏳ Please wait **${formatCooldown(cooldown.remainingMs)}** before using this again.`
        );
      }
    }

    const commands = {
      start: () => startCommand(message),
      profile: () => profileCommand(message),
      hunt: () => huntCommand(message),
      help: () => helpCommand(message, prefix),
      rest: () => restCommand(message),
      hit: () => hitCommand(message),
      retreat: () => retreatCommand(message),
      inventory: () => inventoryCommand(message),
      inv: () => inventoryCommand(message),
      shop: () => shopCommand(message, args),
      buy: () => buyCommand(message, args),
      use: () => useCommand(message, args),
      character: () => characterCommand(message),
      char: () => characterCommand(message),
      equip: () => equipCommand(message, args),
      unequip: () => unequipCommand(message, args),
      announce: () => announceCommand(message, args),
      sell: () => sellCommand(message, args),
      leaderboard: () => leaderboardCommand(message),
      lb: () => leaderboardCommand(message),
      party: () => partyCommand(message, args),
      raid: () => raidCommand(message, args),
      trade: () => tradeCommand(message, args),
      flex: () => flexCommand(message, args),
      admin: () => adminCommand(message, args),
      creator: () => creatorAutoCommand(message, args),
    };

    if (commands[command]) {
      return commands[command]();
    }
  } catch (error) {
    console.error("Command error:", error);
    return message.reply("❌ Something went wrong while running this command.");
  }
};
