const { db } = require("../../firebase/firebase");
const { applyLevelUp } = require("../utils/levelSystem");
const { calculateTotalStats } = require("../utils/statSystem");
const {
  generateBossDrop,
  addItemToInventory,
} = require("../utils/bossLootSystem");

const {
  getActiveBoss,
  saveDamage,
  getDamageRanking,
  deleteBossData,
  getRewardPenalty,
  rollChance,
  getLegendaryChanceByRank,
  calculateThreatGain,
  pickBossTarget,
} = require("../services/bossService");

const bossConfig = require("../data/bossConfig");
const partyConfig = require("../data/partyConfig");

function calculateDamage(playerAttack, bossDefense) {
  const baseDamage = Number(playerAttack || 0) - Number(bossDefense || 0);
  const randomBonus = Math.floor(Math.random() * 15) + 5;

  return Math.max(1, baseDamage + randomBonus);
}

function calculateBossDamage(bossAttack, playerDefense) {
  const baseDamage = Number(bossAttack || 0) - Number(playerDefense || 0);
  const randomBonus = Math.floor(Math.random() * 20) + 10;

  return Math.max(1, baseDamage + randomBonus);
}

async function autoReviveRaidPlayer(playerRef, userId, maxHp) {
  const reviveSeconds = 15;
  const reviveAvailableAt = Date.now() + reviveSeconds * 1000;

  await playerRef.update({
    hp: 0,
    raidReviveAvailableAt: reviveAvailableAt,
  });

  setTimeout(async () => {
    try {
      const latestDoc = await playerRef.get();

      if (!latestDoc.exists) return;

      const latestPlayer = latestDoc.data();

      if (
        Number(latestPlayer.hp || 0) <= 0 &&
        Number(latestPlayer.raidReviveAvailableAt || 0) === reviveAvailableAt
      ) {
        const revivedHp = Math.floor(Number(maxHp || 100) * 0.5);

        await playerRef.update({
          hp: revivedHp,
          raidReviveAvailableAt: null,
        });

        console.log(`${latestPlayer.username || userId} auto revived from raid.`);
      }
    } catch (error) {
      console.error("Raid auto revive error:", error);
    }
  }, reviveSeconds * 1000);

  return reviveSeconds;
}

async function getPlayerParty(userId) {
  const snapshot = await db
    .collection("parties")
    .where("status", "in", ["ready", "raiding"])
    .get();

  for (const doc of snapshot.docs) {
    const party = doc.data();

    if ((party.members || []).includes(userId)) {
      return {
        id: doc.id,
        ...party,
      };
    }
  }

  return null;
}

function formatRanking(ranking) {
  if (ranking.length === 0) {
    return "No damage recorded.";
  }

  return ranking
    .map((entry) => {
      const medal =
        entry.rank === 1
          ? "🥇"
          : entry.rank === 2
          ? "🥈"
          : entry.rank === 3
          ? "🥉"
          : `#${entry.rank}`;

      return `${medal} **${entry.username}** — ${entry.damage} DMG`;
    })
    .join("\n");
}

function formatDroppedItem(item) {
  if (!item) return "No item";

  return (
    `${item.qualityEmoji || ""} **${item.name}**\n` +
    `└ 🔓 Lv.${item.requiredLevel || 1}\n` +
    `└ 🎭 ${(item.compatibleClasses || ["all"]).join(", ")}\n` +
    `└ ⚔️ ATK: ${item.stats?.attack || 0} | 🛡️ DEF: ${
      item.stats?.defense || 0
    } | ❤️ HP: ${item.stats?.maxHp || 0}\n` +
    `└ 💨 Dodge: ${item.stats?.dodge || 0}% | 💥 Crit: ${
      item.stats?.crit || 0
    }%\n` +
    `└ 🏷️ \`${item.id}\``
  );
}

async function distributeRewards(worldId, boss, ranking) {
  const rewardLines = [];

  for (const entry of ranking) {
    const playerRef = db.collection("players").doc(entry.userId);
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) continue;

    const player = playerDoc.data();

    const penalty = getRewardPenalty(
      Number(player.level || 1),
      Number(boss.level || 1)
    );

    const party = await getPlayerParty(entry.userId);
    const hasPartyBonus = !!party;

    const partyGoldBonus = hasPartyBonus ? bossConfig.partyBonus.gold / 100 : 0;
    const partyExpBonus = hasPartyBonus ? bossConfig.partyBonus.exp / 100 : 0;
    const partyLegendaryBonus = hasPartyBonus
      ? bossConfig.partyBonus.legendaryChance
      : 0;

    const baseGold = Number(boss.rewards?.gold || 0);
    const baseExp = Number(boss.rewards?.exp || 0);

    const goldReward = Math.floor(
      baseGold * penalty.goldMultiplier * (1 + partyGoldBonus)
    );

    const expReward = Math.floor(
      baseExp * penalty.expMultiplier * (1 + partyExpBonus)
    );

    const levelResult = applyLevelUp(player, expReward);

    const equipment = player.equipment || {};
    const totalStats = calculateTotalStats(levelResult.baseStats, equipment);

    let legendaryChance = getLegendaryChanceByRank(entry.rank);

    if (!penalty.legendaryAllowed) {
      legendaryChance = 0;
    }

    legendaryChance =
      legendaryChance * penalty.dropMultiplier + partyLegendaryBonus;

    const rareChance =
      Number(bossConfig.participationRewards.rareChance || 0) *
      penalty.dropMultiplier;

    const gotLegendary = rollChance(legendaryChance);
    const gotRare = !gotLegendary && rollChance(rareChance);

    let droppedItem = null;

    if (gotLegendary) {
      droppedItem = generateBossDrop(Number(boss.level || 1), "Legendary");
    } else if (gotRare) {
      droppedItem = generateBossDrop(Number(boss.level || 1), "Rare");
    }

    const inventory = player.inventory || [];

    if (droppedItem) {
      addItemToInventory(inventory, droppedItem);
    }

    const newGold = Number(player.gold || 0) + goldReward;

    const finalHp = levelResult.leveledUp
      ? totalStats.maxHp
      : Number(player.hp || totalStats.maxHp);

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
    });

    rewardLines.push(
      `#${entry.rank} **${entry.username}**\n` +
        `💥 Damage: ${entry.damage}\n` +
        `🪙 Gold: ${goldReward}\n` +
        `⭐ EXP: ${expReward}\n` +
        `🎁 Drop: ${
          droppedItem ? "\n" + formatDroppedItem(droppedItem) : "No item"
        }\n` +
        `📉 Reward: ${penalty.label}${hasPartyBonus ? " + Party Bonus" : ""}`
    );
  }

  return rewardLines.join("\n\n");
}

module.exports = async function raidCommand(message, args = []) {
  const subCommand = String(args[0] || "status").toLowerCase();
  const userId = message.author.id;

  const playerRef = db.collection("players").doc(userId);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("❌ You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();
  const worldId = player.world?.id;

  if (!worldId) {
    return message.reply("❌ You don’t have a selected world.");
  }

  const worldConfig = partyConfig.worlds[worldId];

  if (!worldConfig) {
    return message.reply("❌ Boss raid configuration for your world is missing.");
  }

  if (message.channel.id !== worldConfig.bossRaidChannelId) {
    return message.reply(
      "❌ Raid commands can only be used inside your world's boss-raid channel."
    );
  }

  const boss = await getActiveBoss(worldId);

  if (subCommand === "status") {
    if (!boss || boss.status !== "active") {
      return message.reply("❌ No active world boss in this world right now.");
    }

    return message.reply(
      `👹 **WORLD BOSS STATUS**\n\n` +
        `**${boss.bossName}**\n` +
        `🌍 World: **${worldId}**\n` +
        `⭐ Level: **Lv.${boss.level}**\n` +
        `📌 Recommended: **Lv.${boss.recommendedLevel.min}-${boss.recommendedLevel.max}**\n` +
        `❤️ HP: **${boss.hp}/${boss.maxHp}**\n` +
        `⚔️ Attack: **${boss.attack}**\n` +
        `🛡️ Defense: **${boss.defense}**\n\n` +
        `Use \`!s raid hit\` to attack.`
    );
  }

  if (subCommand !== "hit") {
    return message.reply(
      "❌ Unknown raid command.\n\nUse:\n" +
        "`!s raid status`\n" +
        "`!s raid hit`"
    );
  }

  if (!boss || boss.status !== "active") {
    return message.reply("❌ No active world boss in this world right now.");
  }

  if (Number(player.hp || 0) <= 0) {
    return message.reply(
      "💀 You are defeated. Wait for raid revive or use `!s rest` before attacking again."
    );
  }

  const damage = calculateDamage(player.attack, boss.defense);
  const newBossHp = Math.max(0, Number(boss.hp || 0) - damage);

  const party = await getPlayerParty(userId);
  const threatGain = calculateThreatGain(player, damage);

  await saveDamage(
    worldId,
    {
      userId,
      username: player.username || message.author.username,
    },
    damage,
    party?.id || null,
    threatGain
  );

  await db.collection("worldBosses").doc(worldId).update({
    hp: newBossHp,
  });

  if (newBossHp > 0) {
    await message.reply(
      `⚔️ You hit **${boss.bossName}** for **${damage}** damage!\n` +
        `🔥 Threat Gained: **${threatGain}**\n` +
        `❤️ Boss HP: **${newBossHp}/${boss.maxHp}**`
    );

    const target = await pickBossTarget(worldId);

    if (target) {
      const targetRef = db.collection("players").doc(target.userId);
      const targetDoc = await targetRef.get();

      if (targetDoc.exists) {
        const targetPlayer = targetDoc.data();

        const targetHp = Number(targetPlayer.hp || 0);
        const targetMaxHp = Number(targetPlayer.maxHp || 100);
        const targetDefense = Number(targetPlayer.defense || 0);
        const targetDodge = Number(targetPlayer.dodge || 0);

        if (targetHp > 0) {
          const dodged = rollChance(targetDodge);

          if (dodged) {
            await message.channel.send(
              `💨 **${targetPlayer.username || target.username}** dodged **${boss.bossName}'s** attack!`
            );
          } else {
            const bossDamage = calculateBossDamage(
              boss.attack,
              targetDefense
            );

            const newTargetHp = Math.max(0, targetHp - bossDamage);

            if (newTargetHp <= 0) {
              const reviveSeconds = await autoReviveRaidPlayer(
                targetRef,
                target.userId,
                targetMaxHp
              );

              await message.channel.send(
                `👹 **${boss.bossName}** attacked **${targetPlayer.username || target.username}**!\n` +
                  `💥 Damage: **${bossDamage}**\n` +
                  `💀 **${targetPlayer.username || target.username}** was defeated!\n` +
                  `⏳ Auto revive in **${reviveSeconds}s** with 50% HP.`
              );
            } else {
              await targetRef.update({
                hp: newTargetHp,
              });

              await message.channel.send(
                `👹 **${boss.bossName}** attacked **${targetPlayer.username || target.username}**!\n` +
                  `💥 Damage: **${bossDamage}**\n` +
                  `❤️ ${targetPlayer.username || target.username} HP: **${newTargetHp}/${targetMaxHp}**`
              );
            }
          }
        }
      }
    }

    return;
  }

  await db.collection("worldBosses").doc(worldId).update({
    hp: 0,
    status: "defeated",
    defeatedAt: new Date(),
  });

  const ranking = await getDamageRanking(worldId, 10);
  const rankingText = formatRanking(ranking);
  const rewardText = await distributeRewards(worldId, boss, ranking);

  await message.channel.send(
    `👹 **${boss.bossName} HAS BEEN DEFEATED!**\n\n` +
      `🏆 **Final Damage Ranking**\n` +
      `${rankingText}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🎁 **Rewards Distributed**\n\n` +
      `${rewardText}\n\n` +
      `⏳ Boss ranking data will be deleted in **10 minutes**.`
  );

  setTimeout(async () => {
    await deleteBossData(worldId);
  }, Number(bossConfig.rankingDeleteMinutes || 10) * 60 * 1000);

  return null;
};