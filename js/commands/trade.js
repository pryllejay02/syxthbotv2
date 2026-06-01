const { db } = require("../../firebase/firebase");
const tradeConfig = require("../data/tradeConfig");

const {
  getMentionedUser,
  getPlayer,
  findActiveTrade,
  formatTradeWindow,
  isStarterItem,
  findInventoryItem,
} = require("../utils/tradeUtils");

const {
  createPrivateTradeChannel,
  deleteTradeChannel,
  getTradeSide,
} = require("../services/tradeService");

function normalizeId(value) {
  return String(value || "").toLowerCase();
}

function getDeleteChannelDelayMs() {
  return Number(tradeConfig.deleteChannelDelayMs || 5000);
}

function getInviteExpireMs() {
  return Number(tradeConfig.inviteExpireMs || 120000);
}

function isValidQuantity(quantity) {
  return Number.isInteger(quantity) && quantity > 0;
}

function parseQuantity(value, fallback = 1) {
  const quantity = Number(value || fallback);

  if (!isValidQuantity(quantity)) return null;

  return quantity;
}

function parseGoldAmount(value) {
  const amount = Number(value || 0);

  if (!Number.isInteger(amount)) return null;
  if (amount < 0) return null;

  return amount;
}

function removeItemFromInventory(inventory = [], itemId, quantity) {
  const index = inventory.findIndex(
    (item) => item.id && normalizeId(item.id) === normalizeId(itemId)
  );

  if (index === -1) return false;

  const ownedQty = Number(inventory[index].quantity || 1);

  if (ownedQty < quantity) return false;

  if (ownedQty > quantity) {
    inventory[index] = {
      ...inventory[index],
      quantity: ownedQty - quantity,
    };
  } else {
    inventory.splice(index, 1);
  }

  return true;
}

function addItemToInventory(inventory = [], item) {
  const existingIndex = inventory.findIndex(
    (invItem) =>
      (invItem.baseItemId || invItem.id) === (item.baseItemId || item.id) &&
      invItem.quality === item.quality &&
      JSON.stringify(invItem.stats || {}) === JSON.stringify(item.stats || {})
  );

  if (existingIndex !== -1) {
    inventory[existingIndex].quantity =
      Number(inventory[existingIndex].quantity || 1) +
      Number(item.quantity || 1);
  } else {
    inventory.push({
      ...item,
      quantity: Number(item.quantity || 1),
    });
  }

  return inventory;
}

function hasEnoughInventory(inventory = [], tradeItems = []) {
  for (const tradeItem of tradeItems) {
    const invItem = inventory.find(
      (item) =>
        item.id &&
        tradeItem.id &&
        normalizeId(item.id) === normalizeId(tradeItem.id)
    );

    if (!invItem) return false;

    const ownedQty = Number(invItem.quantity || 1);
    const tradeQty = Number(tradeItem.quantity || 1);

    if (ownedQty < tradeQty) return false;
  }

  return true;
}

function isItemEquipped(player = {}, itemId) {
  const equipment = player.equipment || {};

  return Object.values(equipment).some(
    (item) => item && item.id && normalizeId(item.id) === normalizeId(itemId)
  );
}

function hasEquippedTradeItem(player = {}, tradeItems = []) {
  return tradeItems.some((item) => isItemEquipped(player, item.id));
}

function getOfferQuantity(items = [], itemId) {
  return items
    .filter(
      (item) => item.id && normalizeId(item.id) === normalizeId(itemId)
    )
    .reduce((total, item) => total + Number(item.quantity || 1), 0);
}

function resetConfirmationsPayload() {
  return {
    status: "active",
    player1Confirmed: false,
    player2Confirmed: false,
    updatedAt: new Date(),
  };
}

function getUpdatedTradeWithReset(latestTrade, side, updates = {}) {
  return {
    ...latestTrade,
    ...updates,
    player1Confirmed: false,
    player2Confirmed: false,
    updatedAt: new Date(),
    [side.itemsKey]: updates[side.itemsKey] || latestTrade[side.itemsKey] || [],
  };
}

async function scheduleTradeChannelDelete(guild, channelId) {
  setTimeout(async () => {
    await deleteTradeChannel(guild, channelId).catch(() => null);
  }, getDeleteChannelDelayMs()).unref?.();
}

async function completeTrade(message, trade) {
  const tradeRef = db.collection("trades").doc(trade.id);
  const player1Ref = db.collection("players").doc(trade.player1Id);
  const player2Ref = db.collection("players").doc(trade.player2Id);

  const result = await db.runTransaction(async (transaction) => {
    const latestTradeDoc = await transaction.get(tradeRef);
    const player1Doc = await transaction.get(player1Ref);
    const player2Doc = await transaction.get(player2Ref);

    if (!latestTradeDoc.exists) {
      return {
        ok: false,
        message: "❌ This trade no longer exists.",
      };
    }

    const latestTrade = {
      id: latestTradeDoc.id,
      ...latestTradeDoc.data(),
    };

    if (latestTrade.status === "completed") {
      return {
        ok: false,
        message: "❌ This trade is already completed.",
      };
    }

    if (latestTrade.status === "processing") {
      return {
        ok: false,
        message: "⏳ Trade is already processing.",
      };
    }

    if (latestTrade.status !== "active") {
      return {
        ok: false,
        message: "❌ This trade is not active.",
      };
    }

    if (!latestTrade.player1Confirmed || !latestTrade.player2Confirmed) {
      return {
        ok: false,
        message: "❌ Both players must confirm before the trade can complete.",
      };
    }

    if (!player1Doc.exists || !player2Doc.exists) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ One of the players no longer has a character. Confirmations reset.",
      };
    }

    const player1 = player1Doc.data();
    const player2 = player2Doc.data();

    const p1Inventory = Array.isArray(player1.inventory)
      ? [...player1.inventory]
      : [];

    const p2Inventory = Array.isArray(player2.inventory)
      ? [...player2.inventory]
      : [];

    const p1Gold = Number(player1.gold || 0);
    const p2Gold = Number(player2.gold || 0);

    const player1GoldOffer = Number(latestTrade.player1Gold || 0);
    const player2GoldOffer = Number(latestTrade.player2Gold || 0);

    if (p1Gold < player1GoldOffer) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 1 does not have enough gold anymore. Confirmations reset.",
      };
    }

    if (p2Gold < player2GoldOffer) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 2 does not have enough gold anymore. Confirmations reset.",
      };
    }

    if (!hasEnoughInventory(p1Inventory, latestTrade.player1Items || [])) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 1 no longer has the required item(s). Confirmations reset.",
      };
    }

    if (!hasEnoughInventory(p2Inventory, latestTrade.player2Items || [])) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 2 no longer has the required item(s). Confirmations reset.",
      };
    }

    if (hasEquippedTradeItem(player1, latestTrade.player1Items || [])) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 1 has a trade item equipped. Unequip it first. Confirmations reset.",
      };
    }

    if (hasEquippedTradeItem(player2, latestTrade.player2Items || [])) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 2 has a trade item equipped. Unequip it first. Confirmations reset.",
      };
    }

    for (const item of latestTrade.player1Items || []) {
      const removed = removeItemFromInventory(
        p1Inventory,
        item.id,
        Number(item.quantity || 1)
      );

      if (!removed) {
        transaction.update(tradeRef, resetConfirmationsPayload());

        return {
          ok: false,
          message:
            "❌ Failed to remove Player 1 item during trade. Confirmations reset.",
        };
      }

      addItemToInventory(p2Inventory, item);
    }

    for (const item of latestTrade.player2Items || []) {
      const removed = removeItemFromInventory(
        p2Inventory,
        item.id,
        Number(item.quantity || 1)
      );

      if (!removed) {
        transaction.update(tradeRef, resetConfirmationsPayload());

        return {
          ok: false,
          message:
            "❌ Failed to remove Player 2 item during trade. Confirmations reset.",
        };
      }

      addItemToInventory(p1Inventory, item);
    }

    transaction.update(player1Ref, {
      inventory: p1Inventory,
      gold: p1Gold - player1GoldOffer + player2GoldOffer,
      updatedAt: new Date(),
    });

    transaction.update(player2Ref, {
      inventory: p2Inventory,
      gold: p2Gold - player2GoldOffer + player1GoldOffer,
      updatedAt: new Date(),
    });

    transaction.delete(tradeRef);

    return {
      ok: true,
      trade: latestTrade,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Trade failed.");
  }

  await message.channel.send(
    `🎉 **TRADE COMPLETED!**\n\n` +
      `<@${result.trade.player1Id}> and <@${result.trade.player2Id}> successfully traded.\n\n` +
      `This trade room will be deleted shortly.`
  );

  await scheduleTradeChannelDelete(message.guild, result.trade.channelId);

  return null;
}

module.exports = async function tradeCommand(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const userId = message.author.id;

  if (!message.guild) {
    return message.reply("❌ Trade commands can only be used inside a server.");
  }

  if (!subCommand || message.mentions.users.size > 0) {
    if (message.channel.id !== tradeConfig.createTradeChannelId) {
      return message.reply(
        `❌ Trade invitations can only be created in <#${tradeConfig.createTradeChannelId}>.`
      );
    }

    const targetUser = getMentionedUser(message);

    if (!targetUser || targetUser.bot || targetUser.id === userId) {
      return message.reply(
        "❌ Please mention a valid player.\n\nExample: `!s trade @player`"
      );
    }

    const senderPlayer = await getPlayer(userId);
    const targetPlayer = await getPlayer(targetUser.id);

    if (!senderPlayer || !targetPlayer) {
      return message.reply("❌ Both players must have a character.");
    }

    if (senderPlayer.world?.id !== targetPlayer.world?.id) {
      return message.reply("❌ You can only trade with players in the same world.");
    }

    const senderActiveTrade = await findActiveTrade(userId);
    const targetActiveTrade = await findActiveTrade(targetUser.id);

    if (senderActiveTrade || targetActiveTrade) {
      return message.reply("❌ One of the players is already in a trade.");
    }

    const tradeRef = db.collection("trades").doc();
    const expiresAt = Date.now() + getInviteExpireMs();

    await tradeRef.set({
      tradeId: tradeRef.id,
      player1Id: userId,
      player2Id: targetUser.id,
      player1Username: senderPlayer.username || message.author.username,
      player2Username: targetPlayer.username || targetUser.username,
      player1Items: [],
      player2Items: [],
      player1Gold: 0,
      player2Gold: 0,
      player1Confirmed: false,
      player2Confirmed: false,
      status: "pending",
      channelId: null,
      worldId: senderPlayer.world?.id || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
    });

    const inviteSeconds = Math.ceil(getInviteExpireMs() / 1000);

    const inviteMessage = await message.reply(
      `🤝 <@${userId}> wants to trade with <@${targetUser.id}>.\n\n` +
        `<@${targetUser.id}>, type \`!s trade accept\` within **${inviteSeconds} seconds** to accept.\n` +
        `You can also type \`!s trade decline\`.`
    );

    setTimeout(async () => {
      const latestDoc = await tradeRef.get();

      if (!latestDoc.exists) return;

      const latestTrade = latestDoc.data();

      if (latestTrade.status === "pending") {
        await tradeRef.delete();

        await inviteMessage
          .reply("⏳ Trade invitation expired. No private trade room was created.")
          .catch(() => null);
      }
    }, getInviteExpireMs()).unref?.();

    return null;
  }

  if (subCommand === "accept") {
    const activeTrade = await findActiveTrade(userId);

    if (!activeTrade || activeTrade.status !== "pending") {
      return message.reply("❌ You don’t have any pending trade invitation.");
    }

    if (activeTrade.player2Id !== userId) {
      return message.reply("❌ Only the invited player can accept this trade.");
    }

    if (Date.now() > Number(activeTrade.expiresAt || 0)) {
      await db.collection("trades").doc(activeTrade.id).delete();

      return message.reply("⏳ This trade invitation already expired.");
    }

    const channel = await createPrivateTradeChannel(message, activeTrade);

    if (!channel) {
      return message.reply("❌ Failed to create private trade room.");
    }

    await db.collection("trades").doc(activeTrade.id).update({
      status: "active",
      channelId: channel.id,
      updatedAt: new Date(),
    });

    await channel.send(
      formatTradeWindow({
        ...activeTrade,
        status: "active",
        channelId: channel.id,
      })
    );

    return message.reply(
      `✅ Trade accepted. Private trade room created: <#${channel.id}>`
    );
  }

  if (subCommand === "decline") {
    const activeTrade = await findActiveTrade(userId);

    if (!activeTrade || activeTrade.status !== "pending") {
      return message.reply("❌ You don’t have any pending trade invitation.");
    }

    if (activeTrade.player2Id !== userId) {
      return message.reply("❌ Only the invited player can decline this trade.");
    }

    await db.collection("trades").doc(activeTrade.id).delete();

    return message.reply("❌ Trade invitation declined.");
  }

  const activeTrade = await findActiveTrade(userId);

  if (!activeTrade || activeTrade.status !== "active") {
    return message.reply("❌ You are not inside an active trade.");
  }

  if (message.channel.id !== activeTrade.channelId) {
    return message.reply(
      `❌ Use trade commands inside <#${activeTrade.channelId}>.`
    );
  }

  const side = getTradeSide(activeTrade, userId);

  if (!side) {
    return message.reply("❌ You are not part of this trade.");
  }

  if (subCommand === "status") {
    return message.reply(formatTradeWindow(activeTrade));
  }

  if (subCommand === "add") {
    const itemId = args[1];
    const quantity = parseQuantity(args[2], 1);

    if (!itemId) {
      return message.reply("❌ Usage: `!s trade add <item_id> <qty>`");
    }

    if (!quantity) {
      return message.reply("❌ Quantity must be a whole number greater than 0.");
    }

    const tradeRef = db.collection("trades").doc(activeTrade.id);
    const playerRef = db.collection("players").doc(userId);

    const result = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);
      const playerDoc = await transaction.get(playerRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You no longer have a character.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const player = playerDoc.data();
      const item = findInventoryItem(player, itemId);

      if (!item) {
        return {
          ok: false,
          message: "❌ You don’t have that item.",
        };
      }

      if (isStarterItem(item)) {
        return {
          ok: false,
          message: "❌ Starter items cannot be traded.",
        };
      }

      if (isItemEquipped(player, item.id)) {
        return {
          ok: false,
          message: "❌ You cannot trade an equipped item. Unequip it first.",
        };
      }

      const ownedQty = Number(item.quantity || 1);
      const currentItems = latestTrade[latestSide.itemsKey] || [];
      const alreadyAddedQty = getOfferQuantity(currentItems, item.id);

      if (alreadyAddedQty + quantity > ownedQty) {
        return {
          ok: false,
          message:
            `❌ You only have **${ownedQty}x** of this item, and **${alreadyAddedQty}x** is already in the trade.`,
        };
      }

      const updatedItems = [
        ...currentItems,
        {
          ...item,
          quantity,
        },
      ];

      const updatedTrade = {
        ...latestTrade,
        [latestSide.itemsKey]: updatedItems,
        player1Confirmed: false,
        player2Confirmed: false,
      };

      transaction.update(tradeRef, {
        [latestSide.itemsKey]: updatedItems,
        player1Confirmed: false,
        player2Confirmed: false,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        item,
        quantity,
        trade: updatedTrade,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to add item.");
    }

    return message.reply(
      `✅ Added **${result.item.name} x${result.quantity}** to the trade.\n\n` +
        formatTradeWindow(result.trade)
    );
  }

  if (subCommand === "remove") {
    const itemId = args[1];

    if (!itemId) {
      return message.reply("❌ Usage: `!s trade remove <item_id>`");
    }

    const tradeRef = db.collection("trades").doc(activeTrade.id);

    const result = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const currentItems = latestTrade[latestSide.itemsKey] || [];

      const updatedItems = currentItems.filter(
        (item) => item.id && normalizeId(item.id) !== normalizeId(itemId)
      );

      if (updatedItems.length === currentItems.length) {
        return {
          ok: false,
          message: "❌ That item is not in your trade offer.",
        };
      }

      const updatedTrade = {
        ...latestTrade,
        [latestSide.itemsKey]: updatedItems,
        player1Confirmed: false,
        player2Confirmed: false,
      };

      transaction.update(tradeRef, {
        [latestSide.itemsKey]: updatedItems,
        player1Confirmed: false,
        player2Confirmed: false,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        trade: updatedTrade,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to remove item.");
    }

    return message.reply(
      `✅ Removed item from trade.\n\n` +
        formatTradeWindow(result.trade)
    );
  }

  if (subCommand === "gold") {
    const amount = parseGoldAmount(args[1]);

    if (amount === null) {
      return message.reply(
        "❌ Gold amount must be a whole number and cannot be negative."
      );
    }

    const tradeRef = db.collection("trades").doc(activeTrade.id);
    const playerRef = db.collection("players").doc(userId);

    const result = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);
      const playerDoc = await transaction.get(playerRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You no longer have a character.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const player = playerDoc.data();
      const playerGold = Number(player.gold || 0);

      if (playerGold < amount) {
        return {
          ok: false,
          message: `❌ You only have **${playerGold} Gold**.`,
        };
      }

      const updatedTrade = {
        ...latestTrade,
        [latestSide.goldKey]: amount,
        player1Confirmed: false,
        player2Confirmed: false,
      };

      transaction.update(tradeRef, {
        [latestSide.goldKey]: amount,
        player1Confirmed: false,
        player2Confirmed: false,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        amount,
        trade: updatedTrade,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to update gold offer.");
    }

    return message.reply(
      `✅ Gold offer updated to **${result.amount} Gold**.\n\n` +
        formatTradeWindow(result.trade)
    );
  }

  if (subCommand === "confirm") {
    const tradeRef = db.collection("trades").doc(activeTrade.id);

    const confirmResult = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const updatedTrade = {
        ...latestTrade,
        [latestSide.confirmKey]: true,
      };

      transaction.update(tradeRef, {
        [latestSide.confirmKey]: true,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        trade: updatedTrade,
        bothConfirmed:
          updatedTrade.player1Confirmed && updatedTrade.player2Confirmed,
      };
    });

    if (!confirmResult.ok) {
      return message.reply(
        confirmResult.message || "❌ Trade confirmation failed."
      );
    }

    if (confirmResult.bothConfirmed) {
      return completeTrade(message, confirmResult.trade);
    }

    return message.reply(
      `✅ You confirmed the trade.\n\n` +
        `Waiting for the other player.\n\n` +
        formatTradeWindow(confirmResult.trade)
    );
  }

  if (subCommand === "cancel") {
    const channelId = activeTrade.channelId;

    await db.collection("trades").doc(activeTrade.id).delete();

    await message.reply(
      "🛑 Trade cancelled. This channel will be deleted shortly."
    );

    await scheduleTradeChannelDelete(message.guild, channelId);

    return null;
  }

  return message.reply(
    "❌ Unknown trade command.\n\n" +
      "`!s trade add <item_id> <qty>`\n" +
      "`!s trade remove <item_id>`\n" +
      "`!s trade gold <amount>`\n" +
      "`!s trade confirm`\n" +
      "`!s trade cancel`\n" +
      "`!s trade status`"
  );
};