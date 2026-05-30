const { db } = require("../../firebase/firebase");

const {
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");

const bossConfig = require("../data/bossConfig");
const partyConfig = require("../data/partyConfig");

function getRandomBossByTier(tier) {
  const bosses = bossConfig.bosses[tier] || [];

  if (bosses.length === 0) return null;

  return bosses[Math.floor(Math.random() * bosses.length)];
}

async function getActiveBoss(worldId) {
  const bossDoc = await db.collection("worldBosses").doc(worldId).get();

  if (!bossDoc.exists) return null;

  return {
    id: bossDoc.id,
    ...bossDoc.data(),
  };
}

function getTimestampMillis(value) {
  if (!value) return 0;

  if (typeof value === "number") {
    return value;
  }

  if (value.toMillis) {
    return value.toMillis();
  }

  if (value.toDate) {
    return value.toDate().getTime();
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

async function deleteBossData(worldId) {
  const bossRef = db.collection("worldBosses").doc(worldId);
  const damageSnapshot = await bossRef.collection("damage").get();

  const docs = [...damageSnapshot.docs, { ref: bossRef }];
  const chunkSize = 450;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();

    docs.slice(i, i + chunkSize).forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  console.log(`Boss data for ${worldId} deleted.`);
}

async function clearOldBossIfNeeded(worldId, existingBoss) {
  if (!existingBoss) {
    return {
      cleared: false,
      reason: "no_existing_boss",
    };
  }

  const bossHp = Number(existingBoss.hp || 0);
  const bossStatus = String(existingBoss.status || "unknown").toLowerCase();

  // Clear old defeated, inactive, or corrupted boss data before a new spawn.
  // This also clears the old damage/ranking subcollection.
  if (bossStatus !== "active" || bossHp <= 0) {
    await deleteBossData(worldId);

    return {
      cleared: true,
      reason: "old_inactive_or_defeated_boss",
    };
  }

  const spawnedAt = getTimestampMillis(existingBoss.spawnedAt);
  const expireMinutes = Number(bossConfig.bossExpireMinutes || 120);
  const expiresAt = spawnedAt + expireMinutes * 60 * 1000;

  if (spawnedAt && Date.now() >= expiresAt) {
    await deleteBossData(worldId);

    return {
      cleared: true,
      reason: "old_active_boss_expired",
    };
  }

  return {
    cleared: false,
    reason: "active_boss_still_valid",
  };
}

async function spawnBoss(client, worldId, tier) {
  const worldConfig = partyConfig.worlds[worldId];

  if (!worldConfig) {
    console.log(`Missing party/world config for ${worldId}`);
    return null;
  }

  const existingBoss = await getActiveBoss(worldId);

  if (existingBoss) {
    const cleanupResult = await clearOldBossIfNeeded(worldId, existingBoss);

    if (
      !cleanupResult.cleared &&
      cleanupResult.reason === "active_boss_still_valid"
    ) {
      console.log(`Boss already active in ${worldId}`);
      return existingBoss;
    }

    if (cleanupResult.cleared) {
      console.log(
        `Old boss data cleared in ${worldId}. Reason: ${cleanupResult.reason}`
      );
    }
  }

  const boss = getRandomBossByTier(tier);

  if (!boss) {
    console.log(`No boss found for tier: ${tier}`);
    return null;
  }

  const bossData = {
    worldId,
    bossId: boss.id,
    bossName: boss.name,
    tier,
    level: boss.level,

    hp: boss.hp,
    maxHp: boss.hp,
    attack: boss.attack,
    defense: boss.defense,

    recommendedLevel: boss.recommendedLevel,
    rewards: boss.rewards,

    status: "active",
    spawnedAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection("worldBosses").doc(worldId).set(bossData);

  const channel = await client.channels
    .fetch(worldConfig.bossRaidChannelId)
    .catch(() => null);

  if (channel) {
    const bossImage = boss.image ? new AttachmentBuilder(boss.image) : null;

    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle(`👹 ${boss.name} Appeared!`)
      .setDescription(
        `🌍 World: **${worldId}**\n\n` +
          `⭐ Level: **Lv.${boss.level}**\n` +
          `📌 Recommended: **Lv.${boss.recommendedLevel.min}-${boss.recommendedLevel.max}**\n\n` +
          `❤️ HP: **${boss.hp}/${boss.hp}**\n` +
          `⚔️ Attack: **${boss.attack}**\n` +
          `🛡️ Defense: **${boss.defense}**\n\n` +
          `⚠️ RAID BOSS ACTIVE\n\n` +
          `Use \`!s raid hit\`\n` +
          `Use \`!s raid status\``
      )
      .setFooter({
        text: "Syxth Boss Raid",
      })
      .setTimestamp();

    if (bossImage) {
      embed.setImage(`attachment://${bossImage.name}`);

      await channel.send({
        embeds: [embed],
        files: [bossImage],
      });
    } else {
      await channel.send({
        embeds: [embed],
      });
    }
  }

  return bossData;
}

function calculateThreatGain(player, damage) {
  const defense = Number(player.defense || 0);
  const classId = String(player.classId || "").toLowerCase();

  const tankerBonus = classId === "tanker" ? 300 : 0;

  return Math.floor(Number(damage || 0) + defense * 0.5 + tankerBonus);
}

async function saveDamage(
  worldId,
  player,
  damage,
  partyId = null,
  threatGain = 0
) {
  const damageRef = db
    .collection("worldBosses")
    .doc(worldId)
    .collection("damage")
    .doc(player.userId);

  await db.runTransaction(async (transaction) => {
    const damageDoc = await transaction.get(damageRef);

    if (!damageDoc.exists) {
      transaction.set(damageRef, {
        userId: player.userId,
        username: player.username || "Unknown",
        damage: Number(damage || 0),
        hits: 1,
        partyId,
        threat: Number(threatGain || 0),
        lastHitAt: new Date(),
      });

      return;
    }

    const oldData = damageDoc.data();

    transaction.update(damageRef, {
      username: player.username || oldData.username || "Unknown",
      damage: Number(oldData.damage || 0) + Number(damage || 0),
      hits: Number(oldData.hits || 0) + 1,
      partyId: partyId || oldData.partyId || null,
      threat: Number(oldData.threat || 0) + Number(threatGain || 0),
      lastHitAt: new Date(),
    });
  });
}

async function pickBossTarget(worldId) {
  const snapshot = await db
    .collection("worldBosses")
    .doc(worldId)
    .collection("damage")
    .get();

  const participants = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((entry) => Number(entry.threat || 0) > 0);

  if (participants.length === 0) return null;

  const totalThreat = participants.reduce(
    (total, entry) => total + Number(entry.threat || 0),
    0
  );

  if (totalThreat <= 0) return null;

  let roll = Math.random() * totalThreat;

  for (const entry of participants) {
    roll -= Number(entry.threat || 0);

    if (roll <= 0) return entry;
  }

  return participants[0];
}

async function getDamageRanking(worldId, limit = 10) {
  let query = db
    .collection("worldBosses")
    .doc(worldId)
    .collection("damage")
    .orderBy("damage", "desc");

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc, index) => ({
    rank: index + 1,
    id: doc.id,
    ...doc.data(),
  }));
}

async function getAllDamageRanking(worldId) {
  return getDamageRanking(worldId, null);
}

function getRewardPenalty(playerLevel, bossLevel) {
  const levelDifference = Number(playerLevel || 1) - Number(bossLevel || 1);

  if (levelDifference <= 10) {
    return {
      goldMultiplier: 1,
      expMultiplier: 1,
      dropMultiplier: 1,
      legendaryAllowed: true,
      label: "Full Reward",
    };
  }

  if (levelDifference <= 20) {
    return {
      goldMultiplier: 0.8,
      expMultiplier: 0.8,
      dropMultiplier: 0.8,
      legendaryAllowed: true,
      label: "Slightly Reduced",
    };
  }

  if (levelDifference <= 30) {
    return {
      goldMultiplier: 0.5,
      expMultiplier: 0.5,
      dropMultiplier: 0.4,
      legendaryAllowed: true,
      label: "Reduced",
    };
  }

  if (levelDifference <= 50) {
    return {
      goldMultiplier: 0.25,
      expMultiplier: 0,
      dropMultiplier: 0.15,
      legendaryAllowed: false,
      label: "Heavily Reduced",
    };
  }

  return {
    goldMultiplier: 0.1,
    expMultiplier: 0,
    dropMultiplier: 0.05,
    legendaryAllowed: false,
    label: "Almost No Reward",
  };
}

function rollChance(percent) {
  return Math.random() * 100 < Number(percent || 0);
}

function getLegendaryChanceByRank(rank) {
  if (rank === 1) {
    return bossConfig.rankingRewards.top1.legendaryChance;
  }

  if (rank >= 2 && rank <= 5) {
    return bossConfig.rankingRewards.top2to5.legendaryChance;
  }

  if (rank >= 6 && rank <= 10) {
    return bossConfig.rankingRewards.top6to10.legendaryChance;
  }

  return 0;
}

module.exports = {
  getRandomBossByTier,
  getActiveBoss,
  spawnBoss,
  saveDamage,
  getDamageRanking,
  getAllDamageRanking,
  deleteBossData,
  clearOldBossIfNeeded,
  getRewardPenalty,
  rollChance,
  getLegendaryChanceByRank,
  calculateThreatGain,
  pickBossTarget,
};