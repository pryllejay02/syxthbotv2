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

async function spawnBoss(client, worldId, tier) {
  const worldConfig = partyConfig.worlds[worldId];

  if (!worldConfig) {
    console.log(`Missing party/world config for ${worldId}`);
    return null;
  }

  const existingBoss = await getActiveBoss(worldId);

if (existingBoss && existingBoss.status === "active") {
  const spawnedAt = existingBoss.spawnedAt?.toDate
    ? existingBoss.spawnedAt.toDate()
    : new Date(existingBoss.spawnedAt);

  const expireMinutes = Number(bossConfig.bossExpireMinutes || 120);
  const expiresAt = spawnedAt.getTime() + expireMinutes * 60 * 1000;

  if (Date.now() < expiresAt) {
    console.log(`Boss already active in ${worldId}`);
    return existingBoss;
  }

  console.log(`Boss expired in ${worldId}. Clearing old boss...`);
  await deleteBossData(worldId);
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
  };

  await db.collection("worldBosses").doc(worldId).set(bossData);

  const channel = await client.channels
    .fetch(worldConfig.bossRaidChannelId)
    .catch(() => null);

  if (channel) {

  const bossImage =
    boss.image
      ? new AttachmentBuilder(
          boss.image
        )
      : null;

  const embed =
    new EmbedBuilder()

      .setColor("#8B0000")

      .setTitle(
        `👹 ${boss.name} Appeared!`
      )

      .setDescription(

`🌍 World: **${worldId}**

⭐ Level: **Lv.${boss.level}**
📌 Recommended: **Lv.${boss.recommendedLevel.min}-${boss.recommendedLevel.max}**

❤️ HP: **${boss.hp}/${boss.hp}**
⚔️ Attack: **${boss.attack}**
🛡️ Defense: **${boss.defense}**

⚠️ RAID BOSS ACTIVE

Use \`!s raid hit\`
Use \`!s raid status\``

      )

      .setFooter({
        text: "Syxth Boss Raid"
      });

  if (bossImage) {

    embed.setImage(
      `attachment://${bossImage.name}`
    );

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

  return Math.floor(
    Number(damage || 0) +
      defense * 0.5 +
      tankerBonus
  );
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

  const damageDoc = await damageRef.get();

  if (!damageDoc.exists) {
    await damageRef.set({
      userId: player.userId,
      username: player.username || "Unknown",
      damage,
      hits: 1,
      partyId,
      threat: Number(threatGain || 0),
      lastHitAt: new Date(),
    });

    return;
  }

  const oldData = damageDoc.data();

  await damageRef.update({
    username: player.username || oldData.username || "Unknown",
    damage: Number(oldData.damage || 0) + damage,
    hits: Number(oldData.hits || 0) + 1,
    partyId: partyId || oldData.partyId || null,
    threat: Number(oldData.threat || 0) + Number(threatGain || 0),
    lastHitAt: new Date(),
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

    if (roll <= 0) {
      return entry;
    }
  }

  return participants[0];
}

async function getDamageRanking(worldId, limit = 10) {
  const snapshot = await db
    .collection("worldBosses")
    .doc(worldId)
    .collection("damage")
    .orderBy("damage", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc, index) => ({
    rank: index + 1,
    id: doc.id,
    ...doc.data(),
  }));
}

async function deleteBossData(worldId) {
  const bossRef = db.collection("worldBosses").doc(worldId);

  const damageSnapshot = await bossRef.collection("damage").get();

  const batch = db.batch();

  damageSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  batch.delete(bossRef);

  await batch.commit();

  console.log(`Boss data for ${worldId} deleted.`);
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
  if (rank === 1) return bossConfig.rankingRewards.top1.legendaryChance;
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
  deleteBossData,
  getRewardPenalty,
  rollChance,
  getLegendaryChanceByRank,

  // Aggro v1
  calculateThreatGain,
  pickBossTarget,
};