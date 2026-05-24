const { db } = require("../../firebase/firebase");
const { applyLevelUp, MAX_LEVEL } = require("../utils/levelSystem");
const { calculateTotalStats } = require("../utils/statSystem");
const { generateMonsterDrop } = require("../utils/lootSystem");

function calculateDamage(attackerAttack, defenderDefense) {
  const baseDamage = attackerAttack - defenderDefense;
  const randomBonus = Math.floor(Math.random() * 8) + 1;

  return Math.max(1, baseDamage + randomBonus);
}

function rollChance(percent) {
  return Math.random() * 100 < Number(percent || 0);
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

  const monsterDodgeChance = Number(battle.monsterDodge ?? 0);
  const monsterDodged = rollChance(monsterDodgeChance);

  const playerCritChance = Number(player.crit ?? 0);
  const isCritical = rollChance(playerCritChance);

  let playerDamage = 0;

  if (!monsterDodged) {
    playerDamage = calculateDamage(player.attack, battle.monsterDefense);

    if (isCritical) {
      playerDamage *= 2;
    }

    monsterHp -= playerDamage;
  }

  if (monsterHp <= 0) {
    const levelResult = applyLevelUp(player, battle.monsterExp);
    const newGold = Number(player.gold ?? 0) + battle.monsterGold;

    const equipment = player.equipment || {};
    const totalStats = calculateTotalStats(levelResult.baseStats, equipment);

    const finalHp = levelResult.leveledUp ? totalStats.maxHp : playerHp;

    const inventory = player.inventory || [];
    const droppedItem = generateMonsterDrop(Number(battle.monsterLevel || 1));

if (droppedItem) {
  const existingItemIndex = inventory.findIndex(
    (item) =>
      item.baseItemId === droppedItem.baseItemId &&
      item.quality === droppedItem.quality &&
      JSON.stringify(item.stats) === JSON.stringify(droppedItem.stats)
  );

  if (existingItemIndex !== -1) {
    inventory[existingItemIndex].quantity =
      Number(inventory[existingItemIndex].quantity || 1) + 1;
  } else {
    inventory.push({
      ...droppedItem,
      quantity: 1,
    });
  }
}
    await playerRef.update({
      level: levelResult.level,
      exp: levelResult.exp,
      gold: newGold,
      inventory,

      baseStats: levelResult.baseStats,

      hp: finalHp,
      maxHp: totalStats.maxHp,
      attack: totalStats.attack,
      defense: totalStats.defense,
      dodge: totalStats.dodge,
      crit: totalStats.crit,

      reviveAvailableAt: null,
    });

    await battleRef.delete();

    let reply = `🗡️ You defeated **${battle.monsterName}**!\n\n`;

    if (isCritical) {
      reply += `💥 **CRITICAL HIT!**\n`;
    }

    reply += `⚔️ Your Damage: **${playerDamage}**\n\n`;
    reply += `+${battle.monsterExp} EXP\n`;
    reply += `+${battle.monsterGold} Gold\n`;

if (droppedItem) {
  const className = (droppedItem.compatibleClasses || ["all"])
    .map(
      (cls) =>
        cls.charAt(0).toUpperCase() +
        cls.slice(1)
    )
    .join(", ");

  reply +=
    `\n🎁 **LOOT DROP!**\n` +
    `${droppedItem.emoji || "📦"} **${droppedItem.name}**\n` +
    `🏷️ ID: \`${droppedItem.id}\`\n` +
    `⭐ Quality: **${droppedItem.qualityEmoji} ${droppedItem.quality}**\n` +
    `🔓 Level: **Lv.${droppedItem.requiredLevel || 1}**\n` +
    `🎭 Class: **${className}**\n` +
    `✨ ${droppedItem.description}\n`;

} else if (Number(battle.monsterLevel || 1) >= 5) {
  reply += `\n🎁 **Loot Drop:** None\n`;
}
    if (levelResult.leveledUp) {
      reply += `\n🔥 **LEVEL UP!**\n`;
      reply += `You are now **Level ${levelResult.level}**.\n`;
      reply += `❤️ HP fully restored: ${totalStats.maxHp}/${totalStats.maxHp}\n`;
      reply += `⚔️ Attack: ${totalStats.attack}\n`;
      reply += `🛡️ Defense: ${totalStats.defense}\n`;
      reply += `💨 Dodge: ${Number(totalStats.dodge || 0).toFixed(1)}%\n`;
      reply += `💥 Crit: ${Number(totalStats.crit || 0).toFixed(1)}%\n`;
    }

    if (levelResult.level >= MAX_LEVEL) {
      reply += `\n👑 You reached max level **99**!`;
    } else {
      reply += `\nEXP: ${levelResult.exp}/${levelResult.nextLevelExp}`;
    }

    return message.reply(reply);
  }

  const playerDodgeChance = Number(player.dodge ?? 0);
  const dodged = rollChance(playerDodgeChance);

  const monsterCritChance = Number(battle.monsterCrit ?? 0);
  const monsterCritical = rollChance(monsterCritChance);

  let monsterDamage = 0;

  if (!dodged) {
    monsterDamage = calculateDamage(battle.monsterAttack, player.defense);

    if (monsterCritical) {
      monsterDamage *= 2;
    }

    playerHp -= monsterDamage;
  }

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
        `${monsterDodged ? `💨 Enemy Dodge: **YES**\n` : ""}` +
        `${isCritical ? `💥 Critical Hit: **YES**\n` : ""}` +
        `⚔️ Your Damage: **${playerDamage}**\n` +
        `${monsterCritical ? `🔥 Monster Critical: **YES**\n` : ""}` +
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
    `${monsterDodged ? `💨 **${battle.monsterName} dodged your attack!**\n` : ""}` +
      `${!monsterDodged && isCritical ? `💥 **CRITICAL HIT!**\n` : ""}` +
      `⚔️ You hit **${battle.monsterName}** for **${playerDamage}** damage!\n` +
      `🩸 Monster HP: ${monsterHp}/${battle.monsterMaxHp}\n\n` +
      `${dodged
        ? `💨 **DODGE!** You avoided **${battle.monsterName}'s** attack!\n`
        : `${monsterCritical ? `🔥 **MONSTER CRITICAL HIT!**\n` : ""}` +
          `🔥 ${battle.monsterName} hit you for **${monsterDamage}** damage!\n`
      }` +
      `❤️ Your HP: ${playerHp}/${Number(player.maxHp || 100)}\n\n` +
      `Use \`!s hit\` to attack again or \`!s retreat\` to escape.`
  );
};