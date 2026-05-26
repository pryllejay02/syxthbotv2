const {
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const tradeConfig = require("../data/tradeConfig");

async function createPrivateTradeChannel(message, trade) {
  const channel = await message.guild.channels.create({
    name: `trade-${trade.player1Username}-${trade.player2Username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 90),

    type: ChannelType.GuildText,
    parent: tradeConfig.tradeCategoryId,

    permissionOverwrites: [
      {
        id: message.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: trade.player1Id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: trade.player2Id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ],
  });

  return channel;
}

async function deleteTradeChannel(guild, channelId) {
  const channel = await guild.channels
    .fetch(channelId)
    .catch(() => null);

  if (channel) {
    await channel.delete().catch(() => null);
  }
}

async function resetTradeConfirmations(tradeId) {
  await db.collection("trades").doc(tradeId).update({
    player1Confirmed: false,
    player2Confirmed: false,
  });
}

function getTradeSide(trade, userId) {
  if (trade.player1Id === userId) {
    return {
      itemsKey: "player1Items",
      goldKey: "player1Gold",
      confirmKey: "player1Confirmed",
    };
  }

  if (trade.player2Id === userId) {
    return {
      itemsKey: "player2Items",
      goldKey: "player2Gold",
      confirmKey: "player2Confirmed",
    };
  }

  return null;
}

module.exports = {
  createPrivateTradeChannel,
  deleteTradeChannel,
  resetTradeConfirmations,
  getTradeSide,
};