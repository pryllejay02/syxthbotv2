const { db } = require("../../firebase/firebase");
const { applyLevelUp, MAX_LEVEL } = require("../utils/levelSystem");
const { calculateTotalStats } = require("../utils/statSystem");
const { generateMonsterDrop } = require("../utils/lootSystem");
const balanceConfig = require("../data/balanceConfig");

function getNormalReviveSeconds() {
  return Number(balanceConfig.revive?.normalSeconds || 60);
}

function getInstantReviveCost() {
  return Number(balanceConfig.economy?.restCost || 100);
}

function getMonsterDropMinLevel() {
  return Number(balanceConfig.monsterDrop?.minLevel || 5);
}

function getNormalReviveHp(maxHp) {
  const revivePercent = Number(
    balanceConfig.revive?.freeReviveHpPercent || 50
  );

  return Math.max(
    1,
    Math.floor(Number(maxHp || 100) * (revivePercent / 100))
  );
}

function getNormalHitRandomBonus() {
  if (typeof balanceConfig.getCombatRandomBonus === "function") {
    return balanceConfig.getCombatRandomBonus("normalHitRandomBonus");
  }

  const bonusConfig = balanceConfig.combat?.normalHitRandomBonus || {
    min: 1,
    max: 8,
  };

  const min = Number(bonusConfig.min || 1);
  const max = Number(bonusConfig.max || min);

  if (max <= min) return min;

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateDamage(attackerAttack, defenderDefense) {
  const baseDamage =
    Number(attackerAttack || 0) - Number(defenderDefense || 0);

  const randomBonus = getNormalHitRandomBonus();

  return Math.max(1, baseDamage + randomBonus);
}

function rollChance(percent) {
  return Math.random() * 100 < Number(percent || 0);
}

function addItemToInventory(inventory, droppedItem) {
  if (!droppedItem) return inventory;

  const existingItemIndex = inventory.findIndex(
    (item) =>
      item.baseItemId === droppedItem.baseItemId &&
      item.quality === droppedItem.quality &&
      JSON.stringify(item.stats || {}) ===
        JSON.stringify(droppedItem.stats || {})
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

  return inventory;
}

function formatDroppedItem(droppedItem) {
  if (!droppedItem) return "";

  const className = (droppedItem.compatibleClasses || ["all"])
    .map((cls) => {
      const text = String(cls || "all");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(", ");

  return (
    `\n🎁 **LOOT DROP!**\n` +
    `${droppedItem.emoji || "📦"} **${droppedItem.name}**\n` +
    `🏷️ ID: \`${droppedItem.id}\`\n` +
    `⭐ Quality: **${droppedItem.qualityEmoji} ${droppedItem.quality}**\n` +
    `🔓 Level: **Lv.${droppedItem.requiredLevel || 1}**\n` +
    `🎭 Class: **${className}**\n\n` +
    `⚔️ ATK: ${droppedItem.stats?.attack || 0}\n` +
    `🛡️ DEF: ${droppedItem.stats?.defense || 0}\n` +
    `❤️ HP: ${droppedItem.stats?.maxHp || 0}\n` +
    `💨 Dodge: ${droppedItem.stats?.dodge || 0}%\n` +
    `💥 Crit: ${droppedItem.stats?.crit || 0}%\n`
  );
}

module.exports = async function hitCommand(message) {
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
        message: "You are not in battle. Use `!s hunt` first.",
      };
    }

    const player = playerDoc.data();
    const battle = battleDoc.data();

    let playerHp = Number(player.hp ?? 100);
    let monsterHp = Number(battle.monsterHp ?? battle.monsterMaxHp);

    if (playerHp <= 0) {
      transaction.delete(battleRef);

      return {
        ok: false,
        message:
          "💀 You are defeated. Use `!s rest` or wait for revival before attacking again.",
      };
    }

    const monsterDodgeChance = Number(battle.monsterDodge ?? 0);
    const monsterDodged = rollChance(monsterDodgeChance);

    const playerCritChance = Number(player.crit ?? 0);
    const isCritical = rollChance(playerCritChance);

    let playerDamage = 0;

    if (!monsterDodged) {
      playerDamage = calculateDamage(
        player.attack,
        battle.monsterDefense
      );

      if (isCritical) {
        playerDamage *= 2;
      }

      monsterHp -= playerDamage;
    }

    if (monsterHp <= 0) {
      const levelResult = applyLevelUp(player, battle.monsterExp);

      const newGold =
        Number(player.gold ?? 0) + Number(battle.monsterGold || 0);

      const equipment = player.equipment || {};
      const totalStats = calculateTotalStats(
        levelResult.baseStats,
        equipment
      );

      const finalHp = levelResult.leveledUp ? totalStats.maxHp : playerHp;

      const inventory = [...(player.inventory || [])];
      const droppedItem = generateMonsterDrop(
        Number(battle.monsterLevel || 1)
      );

      addItemToInventory(inventory, droppedItem);

      transaction.update(playerRef, {
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

        monsterKills: Number(player.monsterKills || 0) + 1,

        reviveAvailableAt: null,
        raidReviveAvailableAt: null,

        updatedAt: new Date(),
      });

      transaction.delete(battleRef);

      return {
        ok: true,
        type: "monster_defeated",
        player,
        battle,
        playerDamage,
        monsterDodged,
        isCritical,
        levelResult,
        totalStats,
        droppedItem,
      };
    }

    const playerDodgeChance = Number(player.dodge ?? 0);
    const dodged = rollChance(playerDodgeChance);

    const monsterCritChance = Number(battle.monsterCrit ?? 0);
    const monsterCritical = rollChance(monsterCritChance);

    let monsterDamage = 0;

    if (!dodged) {
      monsterDamage = calculateDamage(
        battle.monsterAttack,
        player.defense
      );

      if (monsterCritical) {
        monsterDamage *= 2;
      }

      playerHp -= monsterDamage;
    }

    if (playerHp <= 0) {
      const reviveSeconds = getNormalReviveSeconds();
      const reviveAvailableAt = Date.now() + reviveSeconds * 1000;

      transaction.update(playerRef, {
        hp: 0,
        reviveAvailableAt,
        raidReviveAvailableAt: null,
        updatedAt: new Date(),
      });

      transaction.delete(battleRef);

      return {
        ok: true,
        type: "player_defeated",
        player,
        battle,
        playerDamage,
        monsterDamage,
        monsterDodged,
        isCritical,
        dodged,
        monsterCritical,
        reviveSeconds,
        reviveAvailableAt,
        instantReviveCost: getInstantReviveCost(),
      };
    }

    transaction.update(playerRef, {
      hp: playerHp,
      updatedAt: new Date(),
    });

    transaction.update(battleRef, {
      monsterHp,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      type: "battle_continue",
      player,
      battle,
      playerHp,
      monsterHp,
      playerDamage,
      monsterDamage,
      monsterDodged,
      isCritical,
      dodged,
      monsterCritical,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Attack failed.");
  }

  if (result.type === "monster_defeated") {
    let reply = `🗡️ You defeated **${result.battle.monsterName}**!\n\n`;

    if (result.monsterDodged) {
      reply += `💨 **${result.battle.monsterName} dodged your attack!**\n`;
    }

    if (result.isCritical && !result.monsterDodged) {
      reply += `💥 **CRITICAL HIT!**\n`;
    }

    reply += `⚔️ Your Damage: **${result.playerDamage}**\n\n`;
    reply += `+${result.battle.monsterExp} EXP\n`;
    reply += `+${result.battle.monsterGold} Gold\n`;

    if (result.droppedItem) {
      reply += formatDroppedItem(result.droppedItem);
    } else if (
      Number(result.battle.monsterLevel || 1) >= getMonsterDropMinLevel()
    ) {
      reply += `\n🎁 **Loot Drop:** None\n`;
    }

    if (result.levelResult.leveledUp) {
      reply += `\n🔥 **LEVEL UP!**\n`;
      reply += `You are now **Level ${result.levelResult.level}**.\n`;
      reply += `❤️ HP fully restored: ${result.totalStats.maxHp}/${result.totalStats.maxHp}\n`;
      reply += `⚔️ Attack: ${result.totalStats.attack}\n`;
      reply += `🛡️ Defense: ${result.totalStats.defense}\n`;
      reply += `💨 Dodge: ${Number(result.totalStats.dodge || 0).toFixed(1)}%\n`;
      reply += `💥 Crit: ${Number(result.totalStats.crit || 0).toFixed(1)}%\n`;
    }

    if (result.levelResult.level >= MAX_LEVEL) {
      reply += `\n👑 You reached max level **${MAX_LEVEL}**!`;
    } else {
      reply += `\nEXP: ${result.levelResult.exp}/${result.levelResult.nextLevelExp}`;
    }

    return message.reply(reply);
  }

  if (result.type === "player_defeated") {
    setTimeout(async () => {
      try {
        const latestDoc = await playerRef.get();

        if (!latestDoc.exists) return;

        const latestPlayer = latestDoc.data();
        const latestHp = Number(latestPlayer.hp ?? 0);
        const latestReviveAvailableAt = Number(
          latestPlayer.reviveAvailableAt ?? 0
        );

        if (
          latestHp <= 0 &&
          latestReviveAvailableAt === Number(result.reviveAvailableAt)
        ) {
          const revivedHp = getNormalReviveHp(latestPlayer.maxHp);

          await playerRef.update({
            hp: revivedHp,
            reviveAvailableAt: null,
            raidReviveAvailableAt: null,
            updatedAt: new Date(),
          });

          const user = await message.client.users
            .fetch(userId)
            .catch(() => null);

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
              .catch(() => null);
          }

          console.log(
            `${latestPlayer.username || userId} has been automatically revived.`
          );
        }
      } catch (error) {
        console.error("Auto revive error:", error);
      }
    }, result.reviveSeconds * 1000).unref?.();

    return message.reply(
      `╔════════════════════╗\n` +
        `💀 𝗬𝗢𝗨 𝗛𝗔𝗩𝗘 𝗕𝗘𝗘𝗡 𝗗𝗘𝗙𝗘𝗔𝗧𝗘𝗗 💀\n` +
        `╚════════════════════╝\n\n` +
        `👹 Enemy: **${result.battle.monsterName}**\n` +
        `${result.monsterDodged ? `💨 Enemy Dodge: **YES**\n` : ""}` +
        `${result.isCritical ? `💥 Critical Hit: **YES**\n` : ""}` +
        `⚔️ Your Damage: **${result.playerDamage}**\n` +
        `${result.monsterCritical ? `🔥 Monster Critical: **YES**\n` : ""}` +
        `🔥 Enemy Damage: **${result.monsterDamage}**\n\n` +
        `⏳ Revival Cooldown: **${result.reviveSeconds} seconds**\n` +
        `💰 Instant Revive Cost: **${result.instantReviveCost} Gold**\n\n` +
        `🛌 Use \`!s rest\` to instantly revive.\n` +
        `⌛ Or wait for automatic revival.`
    );
  }

  return message.reply(
    `${result.monsterDodged ? `💨 **${result.battle.monsterName} dodged your attack!**\n` : ""}` +
      `${!result.monsterDodged && result.isCritical ? `💥 **CRITICAL HIT!**\n` : ""}` +
      `⚔️ You hit **${result.battle.monsterName}** for **${result.playerDamage}** damage!\n` +
      `🩸 Monster HP: ${result.monsterHp}/${result.battle.monsterMaxHp}\n\n` +
      `${
        result.dodged
          ? `💨 **DODGE!** You avoided **${result.battle.monsterName}'s** attack!\n`
          : `${result.monsterCritical ? `🔥 **MONSTER CRITICAL HIT!**\n` : ""}` +
            `🔥 ${result.battle.monsterName} hit you for **${result.monsterDamage}** damage!\n`
      }` +
      `❤️ Your HP: ${result.playerHp}/${Number(result.player.maxHp || 100)}\n\n` +
      `Use \`!s hit\` to attack again or \`!s retreat\` to escape.`
  );
};