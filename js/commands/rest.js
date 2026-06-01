const { db } = require("../../firebase/firebase");
const balanceConfig = require("../data/balanceConfig");
const {
  getReadyReviveField,
  getReviveRemainingSeconds,
  getReviveTypeFromField,
  getReviveHp,
} = require("../utils/reviveSystem");

const REST_COST = Number(balanceConfig.economy?.restCost || 100);

module.exports = async function restCommand(message) {
  const userId = message.author.id;

  const playerRef = db.collection("players").doc(userId);
  const battleRef = db.collection("battles").doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    const battleDoc = await transaction.get(battleRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "You don’t have a character yet. Use `!s start` first.",
      };
    }

    if (battleDoc.exists) {
      const battle = battleDoc.data();

      return {
        ok: false,
        message:
          `⚔️ You cannot rest while fighting **${battle.monsterName}**!\n\n` +
          `Use \`!s hit\`, \`!s use <item_id>\`, or \`!s retreat\`.`,
      };
    }

    const player = playerDoc.data();

    const hp = Number(player.hp ?? 100);
    const maxHp = Number(player.maxHp ?? 100);
    const gold = Number(player.gold ?? 0);

    if (hp <= 0) {
      const readyField = getReadyReviveField(player);

      if (readyField) {
        const reviveType = getReviveTypeFromField(readyField);
        const revivedHp = getReviveHp(maxHp, reviveType);

        transaction.update(playerRef, {
          hp: revivedHp,
          reviveAvailableAt: null,
          raidReviveAvailableAt: null,
          updatedAt: new Date(),
        });

        return {
          ok: true,
          type: "free_revive",
          reviveType,
          revivedHp,
          maxHp,
        };
      }

      const remainingSeconds = getReviveRemainingSeconds(player);

      if (gold < REST_COST) {
        return {
          ok: false,
          message:
            `💀 You are defeated.\n\n` +
            `⏳ Free revive available in **${remainingSeconds} seconds**.\n` +
            `💰 Instant revive cost: **${REST_COST} Gold**\n` +
            `🪙 Your Gold: **${gold}**`,
        };
      }

      const newGold = gold - REST_COST;

      transaction.update(playerRef, {
        hp: maxHp,
        gold: newGold,
        reviveAvailableAt: null,
        raidReviveAvailableAt: null,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        type: "instant_revive",
        revivedHp: maxHp,
        maxHp,
        goldSpent: REST_COST,
        newGold,
      };
    }

    if (hp >= maxHp) {
      return {
        ok: false,
        message: "❤️ Your HP is already full.",
      };
    }

    if (gold < REST_COST) {
      return {
        ok: false,
        message:
          `💰 You need **${REST_COST} Gold** to rest.\n\n` +
          `🪙 Your Gold: **${gold}**`,
      };
    }

    const newGold = gold - REST_COST;

    transaction.update(playerRef, {
      hp: maxHp,
      gold: newGold,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      type: "normal_rest",
      oldHp: hp,
      healedHp: maxHp,
      maxHp,
      goldSpent: REST_COST,
      newGold,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Rest failed.");
  }

  if (result.type === "free_revive") {
    return message.reply(
      `✨ You revived for free after waiting.\n\n` +
        `❤️ HP Restored: **${result.revivedHp}/${result.maxHp}**`
    );
  }

  if (result.type === "instant_revive") {
    return message.reply(
      `🛌 You paid for an instant revival.\n\n` +
        `❤️ HP Fully Restored: **${result.revivedHp}/${result.maxHp}**\n` +
        `💰 Gold Spent: **${result.goldSpent}**\n` +
        `🪙 Remaining Gold: **${result.newGold}**`
    );
  }

  return message.reply(
    `🛌 You rested at the inn.\n\n` +
      `❤️ HP Restored: **${result.oldHp} → ${result.healedHp}/${result.maxHp}**\n` +
      `💰 Gold Spent: **${result.goldSpent}**\n` +
      `🪙 Remaining Gold: **${result.newGold}**`
  );
};