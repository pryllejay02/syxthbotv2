require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

const commandHandler = require("./handlers/commandHandler");
const worldSelection = require("./events/worldSelection");
const guildMemberAdd = require("./events/guildMemberAdd");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
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

console.log("TOKEN loaded:", process.env.TOKEN ? "YES" : "NO");
console.log("PREFIX loaded:", process.env.PREFIX || "NO PREFIX");

client.login(process.env.TOKEN);