const {
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const tradeConfig = require("../data/tradeConfig");

function cleanChannelName(name) {
  return String(name || "player")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function getTradeChannelName(trade) {
  const player1 = cleanChannelName(trade.player1Username || trade.player1Id);
  const player2 = cleanChannelName(trade.player2Username || trade.player2Id);

  return `trade-${player1}-${player2}`.slice(0, 90);
}

async function createPrivateTradeChannel(message, trade) {
  const channel = await message.guild.channels.create({
    name: getTradeChannelName(trade),
    type: ChannelType.GuildText,
    parent: tradeConfig.tradeCategoryId,

    permissionOverwrites: [
      {
        id: message.guild.roles.everyone.id,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
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

    reason: "Syxth MMORPG private trade room created.",
  });

  return channel;
}

async function deleteTradeChannel(guild, channelId) {
  if (!guild || !channelId) return false;

  const channel = await guild.channels
    .fetch(channelId)
    .catch(() => null);

  if (!channel) return false;

  await channel
    .delete("Syxth MMORPG trade room cleanup.")
    .catch(() => null);

  return true;
}

async function resetTradeConfirmations(tradeId) {
  if (!tradeId) {
    return {
      ok: false,
      message: "Missing trade ID.",
    };
  }

  const tradeRef = db.collection("trades").doc(tradeId);

  await tradeRef.update({
    player1Confirmed: false,
    player2Confirmed: false,
    updatedAt: new Date(),
  });

  return {
    ok: true,
  };
}

function resetTradeConfirmationsTransaction(transaction, tradeRef) {
  transaction.update(tradeRef, {
    player1Confirmed: false,
    player2Confirmed: false,
    updatedAt: new Date(),
  });
}

function getTradeSide(trade, userId) {
  if (!trade || !userId) return null;

  if (trade.player1Id === userId) {
    return {
      side: "player1",
      otherSide: "player2",
      userId: trade.player1Id,
      otherUserId: trade.player2Id,
      itemsKey: "player1Items",
      otherItemsKey: "player2Items",
      goldKey: "player1Gold",
      otherGoldKey: "player2Gold",
      confirmKey: "player1Confirmed",
      otherConfirmKey: "player2Confirmed",
    };
  }

  if (trade.player2Id === userId) {
    return {
      side: "player2",
      otherSide: "player1",
      userId: trade.player2Id,
      otherUserId: trade.player1Id,
      itemsKey: "player2Items",
      otherItemsKey: "player1Items",
      goldKey: "player2Gold",
      otherGoldKey: "player1Gold",
      confirmKey: "player2Confirmed",
      otherConfirmKey: "player1Confirmed",
    };
  }

  return null;
}

function isTradeParticipant(trade, userId) {
  if (!trade || !userId) return false;

  return trade.player1Id === userId || trade.player2Id === userId;
}

function getOtherTraderId(trade, userId) {
  const side = getTradeSide(trade, userId);

  if (!side) return null;

  return side.otherUserId;
}

function canUseTradeChannel(message, trade) {
  if (!message || !trade) {
    return {
      ok: false,
      message: "Invalid trade context.",
    };
  }

  if (!isTradeParticipant(trade, message.author.id)) {
    return {
      ok: false,
      message: "❌ You are not part of this trade.",
    };
  }

  if (!trade.channelId) {
    return {
      ok: false,
      message: "❌ This trade has no private trade room.",
    };
  }

  if (message.channel.id !== trade.channelId) {
    return {
      ok: false,
      message: `❌ Use trade commands inside <#${trade.channelId}>.`,
    };
  }

  return {
    ok: true,
  };
}

module.exports = {
  createPrivateTradeChannel,
  deleteTradeChannel,
  resetTradeConfirmations,
  resetTradeConfirmationsTransaction,
  getTradeSide,
  isTradeParticipant,
  getOtherTraderId,
  canUseTradeChannel,
};