const { db } = require("../../firebase/firebase");

const REST_COST = 100;
const REVIVE_WAIT_TIME = 60 * 1000;

module.exports = async function restCommand(message) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);
  const battleRef = db.collection("battles").doc(userId);

  const playerDoc = await playerRef.get();
  const battleDoc = await battleRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  if (battleDoc.exists) {
    const battle = battleDoc.data();

    return message.reply(
      `⚔️ You cannot rest while fighting **${battle.monsterName}**!\n\n` +
      `Use \`!s hit\` or \`!s retreat\`.`
    );
  }

  const player = playerDoc.data();

  const hp = Number(player.hp ?? 100);
  const maxHp = Number(player.maxHp ?? 100);
  const gold = Number(player.gold ?? 0);
  const reviveAvailableAt = Number(player.reviveAvailableAt ?? 0);
  const now = Date.now();

  if (hp <= 0) {
    if (reviveAvailableAt && now >= reviveAvailableAt) {
      const revivedHp = Math.floor(maxHp * 0.5);

      await playerRef.update({
        hp: revivedHp,
        reviveAvailableAt: null,
      });

      return message.reply(
        `✨ You revived for free after waiting.\n\n` +
        `❤️ HP Restored: ${revivedHp}/${maxHp}`
      );
    }

    const remainingSeconds = reviveAvailableAt
      ? Math.max(0, Math.ceil((reviveAvailableAt - now) / 1000))
      : 60;

    if (gold < REST_COST) {
      return message.reply(
        `💀 You are defeated.\n\n` +
        `⏳ Free revive available in **${remainingSeconds} seconds**.\n` +
        `💰 Instant revive cost: **${REST_COST} Gold**\n` +
        `🪙 Your Gold: ${gold}`
      );
    }

    const newGold = gold - REST_COST;

    await playerRef.update({
      hp: maxHp,
      gold: newGold,
      reviveAvailableAt: null,
    });

    return message.reply(
      `🛌 You paid for an instant revival.\n\n` +
      `❤️ HP Fully Restored: ${maxHp}/${maxHp}\n` +
      `💰 Gold Spent: ${REST_COST}\n` +
      `🪙 Remaining Gold: ${newGold}`
    );
  }

  if (hp >= maxHp) {
    return message.reply("❤️ Your HP is already full.");
  }

  if (gold < REST_COST) {
    return message.reply(
      `💰 You need **${REST_COST} Gold** to rest.\n\n` +
      `🪙 Your Gold: ${gold}`
    );
  }

  const newGold = gold - REST_COST;

  await playerRef.update({
    hp: maxHp,
    gold: newGold,
  });

  return message.reply(
    `🛌 You rested at the inn.\n\n` +
    `❤️ HP Restored: ${maxHp}/${maxHp}\n` +
    `💰 Gold Spent: ${REST_COST}\n` +
    `🪙 Remaining Gold: ${newGold}`
  );
};