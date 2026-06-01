const { db } = require("../../firebase/firebase");
const balanceConfig = require("../data/balanceConfig");

const RETREAT_GOLD_PENALTY_PERCENT =
  balanceConfig.economy.retreat.goldPenaltyPercent;

const MIN_RETREAT_PENALTY =
  balanceConfig.economy.retreat.minPenalty;

const MAX_RETREAT_PENALTY =
  balanceConfig.economy.retreat.maxPenalty;

module.exports = async function retreatCommand(message) {
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

    if (!battleDoc.exists) {
      return {
        ok: false,
        message: "You are not in battle.",
      };
    }

    const player = playerDoc.data();
    const battle = battleDoc.data();

    const gold = Number(player.gold || 0);

    const calculatedPenalty = Math.floor(
      gold * (RETREAT_GOLD_PENALTY_PERCENT / 100)
    );

    const penalty = Math.min(
      MAX_RETREAT_PENALTY,
      Math.max(MIN_RETREAT_PENALTY, calculatedPenalty)
    );

    const actualPenalty = Math.min(gold, penalty);
    const newGold = Math.max(0, gold - actualPenalty);

    transaction.update(playerRef, {
      gold: newGold,
      retreats: Number(player.retreats || 0) + 1,
      updatedAt: new Date(),
    });

    transaction.delete(battleRef);

    return {
      ok: true,
      battle,
      oldGold: gold,
      newGold,
      penalty: actualPenalty,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Retreat failed.");
  }

  return message.reply(
    `🏃 You retreated from **${result.battle.monsterName}**.\n\n` +
      `💰 Retreat Penalty: **${result.penalty} Gold**\n` +
      `🪙 Remaining Gold: **${result.newGold}**`
  );
};