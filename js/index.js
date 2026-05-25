require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

const commandHandler = require("./handlers/commandHandler");
const worldSelection = require("./events/worldSelection");
const guildMemberAdd = require("./events/guildMemberAdd");
const voiceStateUpdate = require("./events/voiceStateUpdate");

const { startBossScheduler } = require("./services/bossScheduler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const prefix = process.env.PREFIX || "!s";

client.once("clientReady", () => {
  console.log("=================================");
  console.log(`${client.user.tag} is online!`);
  console.log(`Prefix: ${prefix}`);

  setTimeout(() => {
    console.log(`Ping: ${client.ws.ping}ms`);
  }, 3000);

  // Start World Boss Scheduler
  startBossScheduler(client);

  console.log("Boss scheduler started.");
  console.log("Timezone: Asia/Manila");

  console.log("=================================");
});

client.on("messageCreate", async (message) => {
  await commandHandler(client, message, prefix);
});

client.on("interactionCreate", async (interaction) => {
  await worldSelection(interaction);
});

client.on("guildMemberAdd", (member) => {
  guildMemberAdd(member);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  await voiceStateUpdate(oldState, newState);
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

console.log(
  "TOKEN loaded:",
  process.env.TOKEN ? "YES" : "NO"
);

console.log(
  "PREFIX loaded:",
  process.env.PREFIX || "NO PREFIX"
);

client.login(process.env.TOKEN);