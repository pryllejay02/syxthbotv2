const { db } = require("../../firebase/firebase");

const REST_COST = 100;
const DEFAULT_REVIVE_SECONDS = 60;

function getTimeValue(value) {
  if (!value) return 0;

  if (typeof value === "number") return value;

  if (value.toMillis) {
    return value.toMillis();
  }

  const parsed = Number(value);

  if (!Number.isNaN(parsed)) return parsed;

  const dateParsed = new Date(value).getTime();

  return Number.isNaN(dateParsed) ? 0 : dateParsed;
}

function getReviveTimers(player) {
  return [
    getTimeValue(player.reviveAvailableAt),
    getTimeValue(player.raidReviveAvailableAt),
  ].filter((time) => time > 0);
}

function getRemainingReviveSeconds(player) {
  const now = Date.now();
  const timers = getReviveTimers(player);

  if (!timers.length) return DEFAULT_REVIVE_SECONDS;

  const earliest = Math.min(...timers);

  return Math.max(0, Math.ceil((earliest - now) / 1000));
}

function isReviveReady(player) {
  if (Number(player.hp || 0) > 0) return false;

  const now = Date.now();
  const timers = getReviveTimers(player);

  return timers.some((timer) => now >= timer);
}

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
          `Use \`!s hit\` or \`!s retreat\`.`,
      };
    }

    const player = playerDoc.data();

    const hp = Number(player.hp ?? 100);
    const maxHp = Number(player.maxHp ?? 100);
    const gold = Number(player.gold ?? 0);

    if (hp <= 0) {
      if (isReviveReady(player)) {
        const revivedHp = Math.max(1, Math.floor(maxHp * 0.5));

        transaction.update(playerRef, {
          hp: revivedHp,
          reviveAvailableAt: null,
          raidReviveAvailableAt: null,
          updatedAt: new Date(),
        });

        return {
          ok: true,
          type: "free_revive",
          revivedHp,
          maxHp,
        };
      }

      const remainingSeconds = getRemainingReviveSeconds(player);

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
        `❤️ HP Fully Restored: **${result.maxHp}/${result.maxHp}**\n` +
        `💰 Gold Spent: **${result.goldSpent}**\n` +
        `🪙 Remaining Gold: **${result.newGold}**`
    );
  }

  return message.reply(
    `🛌 You rested at the inn.\n\n` +
      `❤️ HP Restored: **${result.maxHp}/${result.maxHp}**\n` +
      `💰 Gold Spent: **${result.goldSpent}**\n` +
      `🪙 Remaining Gold: **${result.newGold}**`
  );
};