const { db } = require("../../firebase/firebase");
const { applyLevelUp, MAX_LEVEL } = require("../utils/levelSystem");

function calculateDamage(attackerAttack, defenderDefense) {
  const baseDamage = attackerAttack - defenderDefense;
  const randomBonus = Math.floor(Math.random() * 8) + 1;

  return Math.max(1, baseDamage + randomBonus);
}

module.exports = async function hitCommand(message) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);
  const battleRef = db.collection("battles").doc(userId);

  const playerDoc = await playerRef.get();
  const battleDoc = await battleRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  if (!battleDoc.exists) {
    return message.reply("You are not in battle. Use `!s hunt` first.");
  }

  const player = playerDoc.data();
  const battle = battleDoc.data();

  let playerHp = Number(player.hp ?? 100);
  let monsterHp = Number(battle.monsterHp ?? battle.monsterMaxHp);

  const playerDamage = calculateDamage(player.attack, battle.monsterDefense);
  monsterHp -= playerDamage;

  if (monsterHp <= 0) {
    const levelResult = applyLevelUp(player, battle.monsterExp);
    const newGold = Number(player.gold ?? 0) + battle.monsterGold;
    const finalHp = levelResult.leveledUp ? levelResult.maxHp : playerHp;

    await playerRef.update({
      level: levelResult.level,
      exp: levelResult.exp,
      gold: newGold,
      hp: finalHp,
      maxHp: levelResult.maxHp,
      attack: levelResult.attack,
      defense: levelResult.defense,
      reviveAvailableAt: null,
    });

    await battleRef.delete();

    let reply = `🗡️ You defeated **${battle.monsterName}**!\n\n`;
    reply += `+${battle.monsterExp} EXP\n`;
    reply += `+${battle.monsterGold} Gold\n`;

    if (levelResult.leveledUp) {
      reply += `\n🔥 **LEVEL UP!**\n`;
      reply += `You are now **Level ${levelResult.level}**.\n`;
      reply += `❤️ HP fully restored: ${levelResult.maxHp}/${levelResult.maxHp}\n`;
      reply += `⚔️ Attack: ${levelResult.attack}\n`;
      reply += `🛡️ Defense: ${levelResult.defense}\n`;
    }

    if (levelResult.level >= MAX_LEVEL) {
      reply += `\n👑 You reached max level **99**!`;
    } else {
      reply += `\nEXP: ${levelResult.exp}/${levelResult.nextLevelExp}`;
    }

    return message.reply(reply);
  }

  const monsterDamage = calculateDamage(battle.monsterAttack, player.defense);
  playerHp -= monsterDamage;

  if (playerHp <= 0) {
    const reviveSeconds = 60;
    const reviveAvailableAt = Date.now() + reviveSeconds * 1000;

    await playerRef.update({
      hp: 0,
      reviveAvailableAt: reviveAvailableAt,
    });

    await battleRef.delete();

    setTimeout(async () => {
      try {
        const latestDoc = await playerRef.get();

        if (!latestDoc.exists) return;

        const latestPlayer = latestDoc.data();
        const latestHp = Number(latestPlayer.hp ?? 0);
        const latestReviveAvailableAt = Number(latestPlayer.reviveAvailableAt ?? 0);

        if (latestHp <= 0 && latestReviveAvailableAt === reviveAvailableAt) {
          const revivedHp = Math.floor(Number(latestPlayer.maxHp ?? 100) * 0.5);

          await playerRef.update({
            hp: revivedHp,
            reviveAvailableAt: null,
          });

          const user = await message.client.users.fetch(userId);

          if (user) {
            user
              .send(
                `╔════════════════════╗\n` +
                  `✨ 𝗥𝗘𝗩𝗜𝗩𝗔𝗟 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘 ✨\n` +
                  `╚════════════════════╝\n\n` +
                  `❤️ You have been automatically revived.\n` +
                  `🩹 Restored HP: ${revivedHp}/${latestPlayer.maxHp}\n\n` +
                  `⚔️ You may now continue your adventure in **Syxth MMORPG**.`
              )
              .catch(() => {});
          }

          console.log(`${latestPlayer.username} has been automatically revived.`);
        }
      } catch (error) {
        console.error("Auto revive error:", error);
      }
    }, reviveSeconds * 1000);

    return message.reply(
      `╔════════════════════╗\n` +
        `💀 𝗬𝗢𝗨 𝗛𝗔𝗩𝗘 𝗕𝗘𝗘𝗡 𝗗𝗘𝗙𝗘𝗔𝗧𝗘𝗗 💀\n` +
        `╚════════════════════╝\n\n` +
        `👹 Enemy: **${battle.monsterName}**\n` +
        `⚔️ Your Damage: **${playerDamage}**\n` +
        `🔥 Enemy Damage: **${monsterDamage}**\n\n` +
        `⏳ Revival Cooldown: **${reviveSeconds} seconds**\n` +
        `💰 Instant Revive Cost: **100 Gold**\n\n` +
        `🛌 Use \`!s rest\` to instantly revive.\n` +
        `⌛ Or wait for automatic revival.`
    );
  }

  await playerRef.update({
    hp: playerHp,
  });

  await battleRef.update({
    monsterHp: monsterHp,
  });

  return message.reply(
    `⚔️ You hit **${battle.monsterName}** for **${playerDamage}** damage!\n` +
      `🩸 Monster HP: ${monsterHp}/${battle.monsterMaxHp}\n\n` +
      `🔥 ${battle.monsterName} hit you for **${monsterDamage}** damage!\n` +
      `❤️ Your HP: ${playerHp}/${player.maxHp}\n\n` +
      `Use \`!s hit\` to attack again or \`!s retreat\` to escape.`
  );
};