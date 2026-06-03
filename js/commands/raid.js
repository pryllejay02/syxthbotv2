const { db } = require("../../firebase/firebase");
const { applyLevelUp } = require("../utils/levelSystem");
const { calculateTotalStats } = require("../utils/statSystem");
const {
  generateBossDrop,
  addItemToInventory,
} = require("../utils/bossLootSystem");
const { resolvePlayerRevive } = require("../utils/reviveSystem");

const {
  getActivePet,
  applyPetStats,
  addPetExpToActivePet,
  generateBossPetDrop,
  addPetToPets,
  formatDroppedPet,
} = require("../utils/petSystem");

const {
  getActiveBoss,
  saveDamage,
  getDamageRanking,
  getAllDamageRanking,
  deleteBossData,
  getRewardPenalty,
  rollChance,
  calculateThreatGain,
  pickBossTarget,
} = require("../services/bossService");

const bossConfig = require("../data/bossConfig");
const partyConfig = require("../data/partyConfig");
const balanceConfig = require("../data/balanceConfig");

function getRaidRandomBonus(type) {
  if (typeof balanceConfig.getCombatRandomBonus === "function") {
    return balanceConfig.getCombatRandomBonus(type);
  }

  const combatConfig = balanceConfig.combat?.[type];

  if (!combatConfig) return 0;

  const min = Math.ceil(Number(combatConfig.min || 0));
  const max = Math.floor(Number(combatConfig.max || min));

  if (max <= min) return min;

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateDamage(playerAttack, bossDefense, isCritical = false) {
  const baseDamage = Number(playerAttack || 0) - Number(bossDefense || 0);
  const randomBonus = getRaidRandomBonus("raidPlayerHitRandomBonus");

  let damage = Math.max(1, baseDamage + randomBonus);

  if (isCritical) {
    damage *= 2;
  }

  return Math.max(1, Math.floor(damage));
}

function calculateBossDamage(bossAttack, playerDefense, isCritical = false) {
  const baseDamage = Number(bossAttack || 0) - Number(playerDefense || 0);
  const randomBonus = getRaidRandomBonus("raidBossHitRandomBonus");

  let damage = Math.max(1, baseDamage + randomBonus);

  if (isCritical) {
    damage *= 2;
  }

  return Math.max(1, Math.floor(damage));
}

function getRaidReviveHp(maxHp) {
  const revivePercent = Number(
    balanceConfig.revive?.raidReviveHpPercent || 50
  );

  return Math.max(
    1,
    Math.floor(Number(maxHp || 100) * (revivePercent / 100))
  );
}

function getRaidReviveSeconds() {
  return Number(balanceConfig.revive?.raidSeconds || 15);
}

function getRankingDeleteMinutes() {
  return Number(
    balanceConfig.boss?.rankingDeleteMinutes ||
      bossConfig.rankingDeleteMinutes ||
      10
  );
}

function getPartyBonusConfig() {
  return {
    legendaryChance: Number(
      balanceConfig.boss?.partyBonus?.legendaryChance ??
        bossConfig.partyBonus?.legendaryChance ??
        0
    ),
    gold: Number(
      balanceConfig.boss?.partyBonus?.gold ??
        bossConfig.partyBonus?.gold ??
        0
    ),
    exp: Number(
      balanceConfig.boss?.partyBonus?.exp ??
        bossConfig.partyBonus?.exp ??
        0
    ),
  };
}

function getParticipationRareChance() {
  return Number(
    balanceConfig.boss?.participationRareChance ??
      bossConfig.participationRewards?.rareChance ??
      0
  );
}

function getLegendaryChanceByRank(rank) {
  if (rank === 1) {
    return Number(
      balanceConfig.boss?.legendaryChance?.top1 ??
        bossConfig.rankingRewards?.top1?.legendaryChance ??
        0
    );
  }

  if (rank >= 2 && rank <= 5) {
    return Number(
      balanceConfig.boss?.legendaryChance?.top2to5 ??
        bossConfig.rankingRewards?.top2to5?.legendaryChance ??
        0
    );
  }

  if (rank >= 6 && rank <= 10) {
    return Number(
      balanceConfig.boss?.legendaryChance?.top6to10 ??
        bossConfig.rankingRewards?.top6to10?.legendaryChance ??
        0
    );
  }

  return 0;
}

function getBossDodge(boss = {}) {
  return Number(boss.dodge ?? boss.bossDodge ?? 0);
}

function getBossCrit(boss = {}) {
  return Number(boss.crit ?? boss.bossCrit ?? 0);
}

function getPlayerCombatStats(player = {}) {
  const baseStats = player.baseStats || {
    attack: Number(player.attack || 10),
    defense: Number(player.defense || 5),
    maxHp: Number(player.maxHp || 100),
    dodge: Number(player.dodge || 0),
    crit: Number(player.crit || 0),
  };

  const equipmentStats = calculateTotalStats(baseStats, player.equipment || {});
  const activePet = getActivePet(player);

  return applyPetStats(equipmentStats, activePet);
}

async function autoReviveRaidPlayer(playerRef, userId, maxHp) {
  const reviveSeconds = getRaidReviveSeconds();
  const reviveAvailableAt = Date.now() + reviveSeconds * 1000;

  await playerRef.update({
    hp: 0,
    raidReviveAvailableAt: reviveAvailableAt,
    updatedAt: new Date(),
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
        const revivedHp = getRaidReviveHp(maxHp);

        await playerRef.update({
          hp: revivedHp,
          raidReviveAvailableAt: null,
          updatedAt: new Date(),
        });

        console.log(
          `${latestPlayer.username || userId} auto revived from raid.`
        );
      }
    } catch (error) {
      console.error("Raid auto revive error:", error);
    }
  }, reviveSeconds * 1000).unref?.();

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
  if (!ranking.length) return "No damage recorded.";

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

function formatPetRewardLine(petExpResult, droppedPet) {
  const parts = [];

  if (petExpResult?.activePet && Number(petExpResult.gainedExp || 0) > 0) {
    let expText =
      `🐾 Pet EXP: ${petExpResult.activePet.emoji || "🐾"} ` +
      `**${petExpResult.activePet.name}** +${petExpResult.gainedExp} EXP`;

    if (petExpResult.leveledUp) {
      expText += ` | 🔥 Lv.${petExpResult.activePet.level}`;
    }

    parts.push(expText);
  } else {
    parts.push("🐾 Pet EXP: No active pet");
  }

  if (droppedPet) {
    parts.push(`🐾 Pet Drop:\n${formatDroppedPet(droppedPet)}`);
  } else {
    parts.push("🐾 Pet Drop: No pet");
  }

  return parts.join("\n");
}

function shouldRollPetDropByPenalty(penalty = {}) {
  const dropMultiplier = Math.max(0, Number(penalty.dropMultiplier || 0));

  if (dropMultiplier <= 0) return false;
  if (dropMultiplier >= 1) return true;

  return rollChance(Math.min(100, 100 * dropMultiplier));
}

async function distributeRewards(worldId, boss, ranking) {
  const rewardLines = [];
  const partyBonusConfig = getPartyBonusConfig();

  for (const entry of ranking) {
    if (Number(entry.damage || 0) <= 0) continue;

    const playerRef = db.collection("players").doc(entry.userId);

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) return null;

      const player = playerDoc.data();

      const penalty = getRewardPenalty(
        Number(player.level || 1),
        Number(boss.level || 1)
      );

      const hasPartyBonus = !!entry.partyId;

      const partyGoldBonus = hasPartyBonus
        ? partyBonusConfig.gold / 100
        : 0;

      const partyExpBonus = hasPartyBonus
        ? partyBonusConfig.exp / 100
        : 0;

      const partyLegendaryBonus = hasPartyBonus
        ? partyBonusConfig.legendaryChance
        : 0;

      const baseGold = Number(boss.rewards?.gold || 0);
      const baseExp = Number(boss.rewards?.exp || 0);

      const goldReward = Math.max(
        0,
        Math.floor(baseGold * penalty.goldMultiplier * (1 + partyGoldBonus))
      );

      const expReward = Math.max(
        0,
        Math.floor(baseExp * penalty.expMultiplier * (1 + partyExpBonus))
      );

      const levelResult = applyLevelUp(player, expReward);
      const equipment = player.equipment || {};

      let legendaryChance = getLegendaryChanceByRank(entry.rank);

      if (!penalty.legendaryAllowed) {
        legendaryChance = 0;
      }

      legendaryChance =
        legendaryChance * penalty.dropMultiplier + partyLegendaryBonus;

      const rareChance =
        getParticipationRareChance() * penalty.dropMultiplier;

      const gotLegendary = rollChance(legendaryChance);
      const gotRare = !gotLegendary && rollChance(rareChance);

      let droppedItem = null;

      if (gotLegendary) {
        droppedItem = generateBossDrop(Number(boss.level || 1), "Legendary");
      } else if (gotRare) {
        droppedItem = generateBossDrop(Number(boss.level || 1), "Rare");
      }

      const inventory = [...(player.inventory || [])];

      if (droppedItem) {
        addItemToInventory(inventory, droppedItem);
      }

      let pets = [...(player.pets || [])];

      const activePetBefore = getActivePet({
        ...player,
        pets,
        activePetId: player.activePetId || null,
      });

      const petExpGain = activePetBefore
        ? Math.floor(
            Number(expReward || 0) *
              (Number(balanceConfig.pet?.expGain?.bossPercent || 15) / 100)
          )
        : 0;

      const petExpResult = addPetExpToActivePet(
        {
          ...player,
          pets,
          activePetId: player.activePetId || activePetBefore?.id || null,
        },
        petExpGain
      );

      pets = petExpResult.pets;

      let droppedPet = null;

      if (shouldRollPetDropByPenalty(penalty)) {
        droppedPet = generateBossPetDrop(Number(boss.level || 1));
      }

      if (droppedPet) {
        pets = addPetToPets(pets, droppedPet);
      }

      const activePetAfterExp = getActivePet({
        ...player,
        pets,
        activePetId:
          petExpResult.activePet?.id ||
          activePetBefore?.id ||
          player.activePetId ||
          null,
      });

      const equipmentStats = calculateTotalStats(
        levelResult.baseStats,
        equipment
      );

      const totalStats = applyPetStats(equipmentStats, activePetAfterExp);

      const newGold = Number(player.gold || 0) + goldReward;
      const currentHp = Number(player.hp ?? totalStats.maxHp);

      const finalHp = levelResult.leveledUp
        ? totalStats.maxHp
        : Math.min(
            Math.max(0, currentHp),
            Number(totalStats.maxHp || 100)
          );

      transaction.update(playerRef, {
        level: levelResult.level,
        exp: levelResult.exp,
        gold: newGold,

        inventory,
        pets,
        activePetId:
          activePetAfterExp?.id ||
          player.activePetId ||
          activePetBefore?.id ||
          null,

        baseStats: levelResult.baseStats,

        hp: finalHp,
        maxHp: totalStats.maxHp,

        attack: totalStats.attack,
        defense: totalStats.defense,
        dodge: totalStats.dodge,
        crit: totalStats.crit,

        updatedAt: new Date(),
      });

      return {
        player,
        penalty,
        hasPartyBonus,
        goldReward,
        expReward,
        droppedItem,
        droppedPet,
        petExpResult,
      };
    });

    if (!result) continue;

    rewardLines.push(
      `#${entry.rank} **${entry.username}**\n` +
        `💥 Damage: ${entry.damage}\n` +
        `🪙 Gold: ${result.goldReward}\n` +
        `⭐ EXP: ${result.expReward}\n` +
        `🎁 Drop: ${
          result.droppedItem
            ? "\n" + formatDroppedItem(result.droppedItem)
            : "No item"
        }\n` +
        `${formatPetRewardLine(result.petExpResult, result.droppedPet)}\n` +
        `📉 Reward: ${result.penalty.label}${
          result.hasPartyBonus ? " + Party Bonus" : ""
        }`
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
    return message.reply(
      "❌ You don’t have a character yet. Use `!s start` first."
    );
  }

  let player = playerDoc.data();

  const reviveResult = await resolvePlayerRevive(playerRef, player);
  player = reviveResult.player;

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
        `🛡️ Defense: **${boss.defense}**\n` +
        `💨 Dodge: **${getBossDodge(boss)}%**\n` +
        `💥 Crit: **${getBossCrit(boss)}%**\n\n` +
        `Use \`!s raid hit\` to attack.`
    );
  }

  if (subCommand !== "hit") {
    return message.reply(
      "❌ Unknown raid command.\n\n" +
        "Use:\n" +
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

  const playerCombatStats = getPlayerCombatStats(player);
  const bossRef = db.collection("worldBosses").doc(worldId);

  const hitResult = await db.runTransaction(async (transaction) => {
    const bossDoc = await transaction.get(bossRef);

    if (!bossDoc.exists) {
      return {
        error: "NO_BOSS",
      };
    }

    const currentBoss = bossDoc.data();

    if (
      currentBoss.status !== "active" ||
      Number(currentBoss.hp || 0) <= 0
    ) {
      return {
        error: "NO_ACTIVE_BOSS",
      };
    }

    const bossDodged = rollChance(getBossDodge(currentBoss));

    const playerCritical =
      !bossDodged && rollChance(Number(playerCombatStats.crit || 0));

    const damage = bossDodged
      ? 0
      : calculateDamage(
          playerCombatStats.attack,
          currentBoss.defense,
          playerCritical
        );

    const newBossHp = Math.max(0, Number(currentBoss.hp || 0) - damage);
    const defeated = newBossHp <= 0;

    transaction.update(bossRef, {
      hp: newBossHp,
      updatedAt: new Date(),
      ...(defeated
        ? {
            status: "defeated",
            defeatedAt: new Date(),
          }
        : {}),
    });

    return {
      boss: {
        id: bossDoc.id,
        ...currentBoss,
      },
      damage,
      newBossHp,
      defeated,
      bossDodged,
      playerCritical,
    };
  });

  if (
    hitResult.error === "NO_BOSS" ||
    hitResult.error === "NO_ACTIVE_BOSS"
  ) {
    return message.reply("❌ No active world boss in this world right now.");
  }

  const bossForHit = hitResult.boss;
  const damage = hitResult.damage;
  const newBossHp = hitResult.newBossHp;

  const party = await getPlayerParty(userId);
  const threatGain = damage > 0 ? calculateThreatGain(player, damage) : 0;

  if (damage > 0) {
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
  }

  if (newBossHp > 0) {
    await message.reply(
      `${hitResult.bossDodged ? `💨 **${bossForHit.bossName} dodged your attack!**\n` : ""}` +
        `${hitResult.playerCritical ? `💥 **CRITICAL HIT!**\n` : ""}` +
        `${
          damage > 0
            ? `⚔️ You hit **${bossForHit.bossName}** for **${damage}** damage!\n`
            : `⚔️ You dealt **0** damage.\n`
        }` +
        `🔥 Threat Gained: **${threatGain}**\n` +
        `❤️ Boss HP: **${newBossHp}/${bossForHit.maxHp}**`
    );

    const target = await pickBossTarget(worldId);

    if (target) {
      const targetRef = db.collection("players").doc(target.userId);
      const targetDoc = await targetRef.get();

      if (targetDoc.exists) {
        const targetPlayer = targetDoc.data();
        const targetCombatStats = getPlayerCombatStats(targetPlayer);

        const targetHp = Number(targetPlayer.hp || 0);
        const targetMaxHp = Number(targetCombatStats.maxHp || 100);
        const targetDefense = Number(targetCombatStats.defense || 0);
        const targetDodge = Number(targetCombatStats.dodge || 0);

        if (targetHp > 0) {
          const dodged = rollChance(targetDodge);

          if (dodged) {
            await message.channel.send(
              `💨 **${
                targetPlayer.username || target.username
              }** dodged **${bossForHit.bossName}'s** attack!`
            );
          } else {
            const bossCritical = rollChance(getBossCrit(bossForHit));

            const bossDamage = calculateBossDamage(
              bossForHit.attack,
              targetDefense,
              bossCritical
            );

            const newTargetHp = Math.max(0, targetHp - bossDamage);

            if (newTargetHp <= 0) {
              const reviveSeconds = await autoReviveRaidPlayer(
                targetRef,
                target.userId,
                targetMaxHp
              );

              await message.channel.send(
                `👹 **${bossForHit.bossName}** attacked **${
                  targetPlayer.username || target.username
                }**!\n` +
                  `${bossCritical ? `💥 **BOSS CRITICAL HIT!**\n` : ""}` +
                  `💥 Damage: **${bossDamage}**\n` +
                  `💀 **${
                    targetPlayer.username || target.username
                  }** was defeated!\n` +
                  `⏳ Auto revive in **${reviveSeconds}s** with ${balanceConfig.revive?.raidReviveHpPercent || 50}% HP.`
              );
            } else {
              await targetRef.update({
                hp: newTargetHp,
                maxHp: targetCombatStats.maxHp,
                attack: targetCombatStats.attack,
                defense: targetCombatStats.defense,
                dodge: targetCombatStats.dodge,
                crit: targetCombatStats.crit,
                updatedAt: new Date(),
              });

              await message.channel.send(
                `👹 **${bossForHit.bossName}** attacked **${
                  targetPlayer.username || target.username
                }**!\n` +
                  `${bossCritical ? `💥 **BOSS CRITICAL HIT!**\n` : ""}` +
                  `💥 Damage: **${bossDamage}**\n` +
                  `❤️ ${
                    targetPlayer.username || target.username
                  } HP: **${newTargetHp}/${targetMaxHp}**`
              );
            }
          }
        }
      }
    }

    return null;
  }

  const topRanking = await getDamageRanking(worldId, 10);
  const allRanking = await getAllDamageRanking(worldId);
  const rankingText = formatRanking(topRanking);
  const rewardText = await distributeRewards(worldId, bossForHit, allRanking);
  const rankingDeleteMinutes = getRankingDeleteMinutes();

  await message.channel.send(
    `👹 **${bossForHit.bossName} HAS BEEN DEFEATED!**\n\n` +
      `🏆 **Final Damage Ranking**\n` +
      `${rankingText}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🎁 **Rewards Distributed**\n\n` +
      `${rewardText || "No valid participants."}\n\n` +
      `⏳ Boss ranking data will be deleted in **${rankingDeleteMinutes} minutes**.`
  );

  setTimeout(async () => {
    await deleteBossData(worldId);
  }, rankingDeleteMinutes * 60 * 1000).unref?.();

  return null;
};