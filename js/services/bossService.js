const { db } = require("../../firebase/firebase");

const {
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");

const bossConfig = require("../data/bossConfig");
const partyConfig = require("../data/partyConfig");
const balanceConfig = require("../data/balanceConfig");

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

  const parsedNumber = Number(value);

  if (!Number.isNaN(parsedNumber)) {
    return parsedNumber;
  }

  const parsedDate = new Date(value).getTime();

  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

function getBossExpireMinutes() {
  return Number(
    balanceConfig.boss?.bossExpireMinutes ||
      bossConfig.bossExpireMinutes ||
      120
  );
}

function getBossStat(boss = {}, statName, fallback = 0) {
  return Number(boss[statName] ?? fallback);
}

function getBossRecommendedLevel(boss = {}) {
  return {
    min: Number(boss.recommendedLevel?.min || 1),
    max: Number(boss.recommendedLevel?.max || boss.level || 1),
  };
}

function getBossRewards(boss = {}) {
  return {
    gold: Number(boss.rewards?.gold || 0),
    exp: Number(boss.rewards?.exp || 0),
  };
}

function buildBossData(worldId, tier, boss) {
  const hp = getBossStat(boss, "hp", 1);
  const attack = getBossStat(boss, "attack", 1);
  const defense = getBossStat(boss, "defense", 0);
  const dodge = getBossStat(boss, "dodge", 0);
  const crit = getBossStat(boss, "crit", 0);

  return {
    worldId,
    bossId: boss.id,
    bossName: boss.name,
    tier,

    level: Number(boss.level || 1),

    hp,
    maxHp: hp,
    attack,
    defense,
    dodge,
    crit,

    recommendedLevel: getBossRecommendedLevel(boss),
    rewards: getBossRewards(boss),

    status: "active",
    spawnedAt: new Date(),
    updatedAt: new Date(),
  };
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
  const expireMinutes = getBossExpireMinutes();
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

  const bossData = buildBossData(worldId, tier, boss);

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
          `⭐ Level: **Lv.${bossData.level}**\n` +
          `📌 Recommended: **Lv.${bossData.recommendedLevel.min}-${bossData.recommendedLevel.max}**\n\n` +
          `❤️ HP: **${bossData.hp}/${bossData.maxHp}**\n` +
          `⚔️ Attack: **${bossData.attack}**\n` +
          `🛡️ Defense: **${bossData.defense}**\n` +
          `💨 Dodge: **${bossData.dodge}%**\n` +
          `💥 Crit: **${bossData.crit}%**\n\n` +
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
  if (typeof balanceConfig.getBossRewardPenalty === "function") {
    return balanceConfig.getBossRewardPenalty(playerLevel, bossLevel);
  }

  return {
    goldMultiplier: 1,
    expMultiplier: 1,
    dropMultiplier: 1,
    legendaryAllowed: true,
    label: "Full Reward",
  };
}

function rollChance(percent) {
  return Math.random() * 100 < Number(percent || 0);
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