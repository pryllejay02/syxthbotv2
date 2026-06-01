require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

const commandHandler = require("./handlers/commandHandler");
const worldSelection = require("./events/worldSelection");
const guildMemberAdd = require("./events/guildMemberAdd");
const voiceStateUpdate = require("./events/voiceStateUpdate");

const { startBossScheduler } = require("./services/bossScheduler");
const { startTradeCleanup } = require("./services/tradeCleanupService");
const { startPartyCleanup } = require("./services/partyCleanupService");

const prefix = process.env.PREFIX || "!s";
const token = process.env.TOKEN;

if (!token) {
  console.error("❌ TOKEN is missing in your .env file.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once("clientReady", () => {
  console.log("=================================");
  console.log(`${client.user.tag} is online!`);
  console.log(`Prefix: ${prefix}`);

  setTimeout(() => {
    console.log(`Ping: ${client.ws.ping}ms`);
  }, 3000);

  // Start World Boss Scheduler
  startBossScheduler(client);

  // Start Trade Cleanup Service
  startTradeCleanup(client);

  // Start Party Cleanup Service
  startPartyCleanup(client);

  console.log("Boss scheduler started.");
  console.log("Trade cleanup service started.");
  console.log("Party cleanup service started.");
  console.log("Timezone: Asia/Manila");
  console.log("=================================");
});

client.on("messageCreate", async (message) => {
  try {
    await commandHandler(client, message, prefix);
  } catch (error) {
    console.error("messageCreate handler error:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    await worldSelection(interaction);
  } catch (error) {
    console.error("interactionCreate handler error:", error);

    if (interaction.replied || interaction.deferred) {
      await interaction
        .followUp({
          content: "❌ Something went wrong while processing this interaction.",
          ephemeral: true,
        })
        .catch(() => null);
    } else {
      await interaction
        .reply({
          content: "❌ Something went wrong while processing this interaction.",
          ephemeral: true,
        })
        .catch(() => null);
    }
  }
});

client.on("guildMemberAdd", async (member) => {
  try {
    await guildMemberAdd(member);
  } catch (error) {
    console.error("guildMemberAdd handler error:", error);
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    await voiceStateUpdate(oldState, newState);
  } catch (error) {
    console.error("voiceStateUpdate handler error:", error);
  }
});

client.on("error", (error) => {
  console.error("Discord Client Error:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("SIGINT", () => {
  console.log("Shutting down bot...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down bot...");
  client.destroy();
  process.exit(0);
});

console.log("TOKEN loaded:", token ? "YES" : "NO");
console.log("PREFIX loaded:", prefix);

client.login(token);