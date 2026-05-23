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

module.exports = async function commandHandler(client, message, prefix) {
  try {
    if (message.author.bot) return;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content
      .slice(prefix.length)
      .trim()
      .split(/ +/);

    const command = args.shift()?.toLowerCase();

    // =========================
    // PING COMMAND
    // =========================
    if (command === "ping") {
      const sent = await message.reply(
        "🏓 Checking ping..."
      );

      const wsPing =
        client.ws.ping === -1
          ? "Still calculating..."
          : `${client.ws.ping}ms`;

      return sent.edit(
        `🏓 Pong!\n` +
          `🌐 WebSocket Ping: ${wsPing}\n` +
          `⚡ Message Latency: ${
            sent.createdTimestamp -
            message.createdTimestamp
          }ms`
      );
    }

    // =========================
    // COMMAND LIST
    // =========================
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
    };

    // =========================
    // EXECUTE COMMAND
    // =========================
    if (commands[command]) {
      return commands[command]();
    }

  } catch (error) {
    console.error("Command error:", error);

    return message.reply(
      "❌ Something went wrong while running this command."
    );
  }
};