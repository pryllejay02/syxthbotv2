const { db } = require("../../firebase/firebase");
const tradeConfig = require("../data/tradeConfig");

const {
  getMentionedUser,
  getPlayer,
  findActiveTrade,
  formatTradeWindow,
  isStarterItem,
} = require("../utils/tradeUtils");

const {
  createPrivateTradeChannel,
  deleteTradeChannel,
  getTradeSide,
} = require("../services/tradeService");

function findInventoryItem(inventory, itemId) {
  return inventory.find(
    (item) => item.id.toLowerCase() === itemId.toLowerCase()
  );
}

function removeItemFromInventory(inventory, itemId, quantity) {
  const index = inventory.findIndex(
    (item) => item.id.toLowerCase() === itemId.toLowerCase()
  );

  if (index === -1) return false;

  const ownedQty = Number(inventory[index].quantity || 1);

  if (ownedQty > quantity) {
    inventory[index].quantity = ownedQty - quantity;
  } else {
    inventory.splice(index, 1);
  }

  return true;
}

function addItemToInventory(inventory, item) {
  const existingIndex = inventory.findIndex(
    (invItem) =>
      invItem.baseItemId === item.baseItemId &&
      invItem.quality === item.quality &&
      JSON.stringify(invItem.stats) === JSON.stringify(item.stats)
  );

  if (existingIndex !== -1) {
    inventory[existingIndex].quantity =
      Number(inventory[existingIndex].quantity || 1) +
      Number(item.quantity || 1);
  } else {
    inventory.push(item);
  }
}

function hasEnoughInventory(inventory, tradeItems = []) {
  for (const tradeItem of tradeItems) {
    const invItem = inventory.find(
      (item) =>
        item.id.toLowerCase() === tradeItem.id.toLowerCase()
    );

    if (!invItem) return false;

    const ownedQty = Number(invItem.quantity || 1);
    const tradeQty = Number(tradeItem.quantity || 1);

    if (ownedQty < tradeQty) return false;
  }

  return true;
}

function isItemEquipped(player, itemId) {
  const equipment = player.equipment || {};

  return Object.values(equipment).some(
    (item) =>
      item &&
      item.id &&
      item.id.toLowerCase() === itemId.toLowerCase()
  );
}

function hasEquippedTradeItem(player, tradeItems = []) {
  return tradeItems.some((item) =>
    isItemEquipped(player, item.id)
  );
}

async function resetTradeToActive(tradeRef) {
  await tradeRef.update({
    status: "active",
    player1Confirmed: false,
    player2Confirmed: false,
  });
}

async function completeTrade(message, trade) {
  const tradeRef = db.collection("trades").doc(trade.id);
  const player1Ref = db.collection("players").doc(trade.player1Id);
  const player2Ref = db.collection("players").doc(trade.player2Id);

  const resetPayload = {
    status: "active",
    player1Confirmed: false,
    player2Confirmed: false,
  };

  const result = await db.runTransaction(async (transaction) => {
    // IMPORTANT: Firestore transactions must finish all reads before writes.
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
      transaction.update(tradeRef, resetPayload);

      return {
        ok: false,
        message: "❌ One of the players no longer has a character. Confirmations reset.",
      };
    }

    const player1 = player1Doc.data();
    const player2 = player2Doc.data();

    const p1Inventory = [...(player1.inventory || [])];
    const p2Inventory = [...(player2.inventory || [])];

    const p1Gold = Number(player1.gold || 0);
    const p2Gold = Number(player2.gold || 0);

    if (p1Gold < Number(latestTrade.player1Gold || 0)) {
      transaction.update(tradeRef, resetPayload);

      return {
        ok: false,
        message: "❌ Player 1 does not have enough gold anymore. Confirmations reset.",
      };
    }

    if (p2Gold < Number(latestTrade.player2Gold || 0)) {
      transaction.update(tradeRef, resetPayload);

      return {
        ok: false,
        message: "❌ Player 2 does not have enough gold anymore. Confirmations reset.",
      };
    }

    if (!hasEnoughInventory(p1Inventory, latestTrade.player1Items || [])) {
      transaction.update(tradeRef, resetPayload);

      return {
        ok: false,
        message: "❌ Player 1 no longer has the required item(s). Confirmations reset.",
      };
    }

    if (!hasEnoughInventory(p2Inventory, latestTrade.player2Items || [])) {
      transaction.update(tradeRef, resetPayload);

      return {
        ok: false,
        message: "❌ Player 2 no longer has the required item(s). Confirmations reset.",
      };
    }

    if (hasEquippedTradeItem(player1, latestTrade.player1Items || [])) {
      transaction.update(tradeRef, resetPayload);

      return {
        ok: false,
        message: "❌ Player 1 has a trade item equipped. Unequip it first. Confirmations reset.",
      };
    }

    if (hasEquippedTradeItem(player2, latestTrade.player2Items || [])) {
      transaction.update(tradeRef, resetPayload);

      return {
        ok: false,
        message: "❌ Player 2 has a trade item equipped. Unequip it first. Confirmations reset.",
      };
    }

    for (const item of latestTrade.player1Items || []) {
      removeItemFromInventory(p1Inventory, item.id, Number(item.quantity || 1));
      addItemToInventory(p2Inventory, item);
    }

    for (const item of latestTrade.player2Items || []) {
      removeItemFromInventory(p2Inventory, item.id, Number(item.quantity || 1));
      addItemToInventory(p1Inventory, item);
    }

    transaction.update(player1Ref, {
      inventory: p1Inventory,
      gold:
        p1Gold -
        Number(latestTrade.player1Gold || 0) +
        Number(latestTrade.player2Gold || 0),
    });

    transaction.update(player2Ref, {
      inventory: p2Inventory,
      gold:
        p2Gold -
        Number(latestTrade.player2Gold || 0) +
        Number(latestTrade.player1Gold || 0),
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
    `🎉 **TRADE COMPLETED!**

` +
      `<@${result.trade.player1Id}> and <@${result.trade.player2Id}> successfully traded.

` +
      `This trade room will be deleted shortly.`
  );

  setTimeout(async () => {
    await deleteTradeChannel(message.guild, result.trade.channelId);
  }, tradeConfig.deleteChannelDelayMs).unref?.();
}

module.exports = async function tradeCommand(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const userId = message.author.id;

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

    const senderActiveTrade = await findActiveTrade(userId);
    const targetActiveTrade = await findActiveTrade(targetUser.id);

    if (senderActiveTrade || targetActiveTrade) {
      return message.reply("❌ One of the players is already in a trade.");
    }

    const tradeRef = db.collection("trades").doc();
    const expiresAt = Date.now() + tradeConfig.inviteExpireMs;

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
      createdAt: new Date(),
      expiresAt,
    });

    const inviteMessage = await message.reply(
      `🤝 <@${userId}> wants to trade with <@${targetUser.id}>.\n\n` +
        `<@${targetUser.id}>, type \`!s trade accept\` within **2 minutes** to accept.\n` +
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
    }, tradeConfig.inviteExpireMs);

    return;
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

    await db.collection("trades").doc(activeTrade.id).update({
      status: "active",
      channelId: channel.id,
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
    const quantity = Number(args[2] || 1);

    if (!itemId) {
      return message.reply("❌ Usage: `!s trade add <item_id> <qty>`");
    }

    if (quantity <= 0) {
      return message.reply("❌ Quantity must be greater than 0.");
    }

    const player = await getPlayer(userId);
    const inventory = player.inventory || [];

    const item = findInventoryItem(inventory, itemId);

    if (!item) {
      return message.reply("❌ You don’t have that item.");
    }

    if (isStarterItem(item)) {
      return message.reply("❌ Starter items cannot be traded.");
    }

    if (hasEquippedTradeItem(player, [item])) {
      return message.reply(
        "❌ You cannot trade an equipped item. Unequip it first."
      );
    }

    const ownedQty = Number(item.quantity || 1);

    if (ownedQty < quantity) {
      return message.reply(`❌ You only have **${ownedQty}x** of this item.`);
    }

    const currentItems = activeTrade[side.itemsKey] || [];

    const alreadyAddedQty = currentItems
      .filter((tradeItem) => tradeItem.id === item.id)
      .reduce(
        (total, tradeItem) => total + Number(tradeItem.quantity || 1),
        0
      );

    if (alreadyAddedQty + quantity > ownedQty) {
      return message.reply(
        "❌ You already added too much of this item to the trade."
      );
    }

    currentItems.push({
      ...item,
      quantity,
    });

    await db.collection("trades").doc(activeTrade.id).update({
      [side.itemsKey]: currentItems,
      player1Confirmed: false,
      player2Confirmed: false,
    });

    return message.reply(
      `✅ Added **${item.name} x${quantity}** to the trade.\n\n` +
        formatTradeWindow({
          ...activeTrade,
          [side.itemsKey]: currentItems,
          player1Confirmed: false,
          player2Confirmed: false,
        })
    );
  }

  if (subCommand === "remove") {
    const itemId = args[1];

    if (!itemId) {
      return message.reply("❌ Usage: `!s trade remove <item_id>`");
    }

    const currentItems = activeTrade[side.itemsKey] || [];

    const updatedItems = currentItems.filter(
      (item) => item.id.toLowerCase() !== itemId.toLowerCase()
    );

    if (updatedItems.length === currentItems.length) {
      return message.reply("❌ That item is not in your trade offer.");
    }

    await db.collection("trades").doc(activeTrade.id).update({
      [side.itemsKey]: updatedItems,
      player1Confirmed: false,
      player2Confirmed: false,
    });

    return message.reply(
      `✅ Removed item from trade.\n\n` +
        formatTradeWindow({
          ...activeTrade,
          [side.itemsKey]: updatedItems,
          player1Confirmed: false,
          player2Confirmed: false,
        })
    );
  }

  if (subCommand === "gold") {
    const amount = Number(args[1] || 0);

    if (amount < 0) {
      return message.reply("❌ Gold amount cannot be negative.");
    }

    const player = await getPlayer(userId);
    const playerGold = Number(player.gold || 0);

    if (playerGold < amount) {
      return message.reply(`❌ You only have **${playerGold} Gold**.`);
    }

    await db.collection("trades").doc(activeTrade.id).update({
      [side.goldKey]: amount,
      player1Confirmed: false,
      player2Confirmed: false,
    });

    return message.reply(
      `✅ Gold offer updated to **${amount} Gold**.\n\n` +
        formatTradeWindow({
          ...activeTrade,
          [side.goldKey]: amount,
          player1Confirmed: false,
          player2Confirmed: false,
        })
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
      });

      return {
        ok: true,
        trade: updatedTrade,
        bothConfirmed:
          updatedTrade.player1Confirmed && updatedTrade.player2Confirmed,
      };
    });

    if (!confirmResult.ok) {
      return message.reply(confirmResult.message || "❌ Trade confirmation failed.");
    }

    if (confirmResult.bothConfirmed) {
      return completeTrade(message, confirmResult.trade);
    }

    return message.reply(
      `✅ You confirmed the trade.

Waiting for the other player.

` +
        formatTradeWindow(confirmResult.trade)
    );
  }

  if (subCommand === "cancel") {
    const channelId = activeTrade.channelId;

    await db.collection("trades").doc(activeTrade.id).delete();

    await message.reply(
      "🛑 Trade cancelled. This channel will be deleted shortly."
    );

    setTimeout(async () => {
      await deleteTradeChannel(message.guild, channelId);
    }, tradeConfig.deleteChannelDelayMs);

    return;
  }

  return message.reply(
    "❌ Unknown trade command.\n\n" +
      "`!s trade add <item_id> <qty>`\n" +
      "`!s trade remove <item_id>`\n" +
      "`!s trade gold <amount>`\n" +
      "`!s trade confirm`\n" +
      "`!s trade cancel`"
  );
};