const path = require("path");

const {
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");
const bossConfig = require("../data/bossConfig");

const {
  getActiveBoss,
  deleteBossData,
  clearOldBossIfNeeded,
} = require("../services/bossService");

function getBossExpireMs() {
  const expireMinutes = Number(bossConfig.bossExpireMinutes || 120);

  return expireMinutes * 60 * 1000;
}

function getBossByTierOrId(input) {
  const key = String(input || "").toLowerCase();

  if (!key) return null;

  if (bossConfig.bosses?.[key]) {
    const bosses = bossConfig.bosses[key];

    if (!Array.isArray(bosses) || bosses.length === 0) {
      return null;
    }

    const boss = bosses[Math.floor(Math.random() * bosses.length)];

    return {
      boss,
      tier: key,
      source: "tier",
    };
  }

  for (const [tier, bosses] of Object.entries(bossConfig.bosses || {})) {
    const foundBoss = bosses.find(
      (boss) => String(boss.id || "").toLowerCase() === key
    );

    if (foundBoss) {
      return {
        boss: foundBoss,
        tier,
        source: "boss_id",
      };
    }
  }

  return null;
}

function getAvailableBossHelp() {
  const tiers = Object.keys(bossConfig.bosses || {});
  const bossIds = [];

  for (const bosses of Object.values(bossConfig.bosses || {})) {
    bosses.forEach((boss) => {
      if (boss.id) bossIds.push(boss.id);
    });
  }

  return (
    `Available tiers:\n` +
    `\`${tiers.length ? tiers.join(" ") : "No tiers configured"}\`\n\n` +
    `Available boss IDs:\n` +
    `\`${bossIds.length ? bossIds.slice(0, 25).join(" ") : "No boss IDs configured"}\``
  );
}

function normalizeBossData(boss) {
  const level = Number(boss.level || 1);
  const hp = Number(boss.hp || 1);
  const attack = Number(boss.attack || 1);
  const defense = Number(boss.defense || 0);

  return {
    ...boss,
    level,
    hp,
    attack,
    defense,

    recommendedLevel: boss.recommendedLevel || {
      min: Math.max(1, level - 5),
      max: level + 10,
    },

    rewards: boss.rewards || {
      gold: 0,
      exp: 0,
    },
  };
}

async function sendBossAnnouncement(client, worldId, worldConfig, rawBoss) {
  const channel = await client.channels
    .fetch(worldConfig.bossRaidChannelId)
    .catch(() => null);

  if (!channel) return false;

  const boss = normalizeBossData(rawBoss);

  let bossImage = null;
  let bossImageName = null;

  if (boss.image) {
    bossImageName = path.basename(boss.image);
    bossImage = new AttachmentBuilder(boss.image, {
      name: bossImageName,
    });
  }

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
        `🎁 Rewards: **${boss.rewards.exp || 0} EXP** • **${boss.rewards.gold || 0} Gold**\n\n` +
        `⚠️ RAID BOSS ACTIVE\n\n` +
        `Use \`!s raid hit\`\n` +
        `Use \`!s raid status\``
    )
    .setFooter({
      text: "Syxth Boss Raid",
    })
    .setTimestamp();

  if (bossImage && bossImageName) {
    embed.setImage(`attachment://${bossImageName}`);

    await channel.send({
      embeds: [embed],
      files: [bossImage],
    });

    return true;
  }

  await channel.send({
    embeds: [embed],
  });

  return true;
}

async function clearOldBossBeforeSummon(message, worldId) {
  const existingBoss = await getActiveBoss(worldId);

  if (!existingBoss) {
    return {
      ok: true,
      cleared: false,
      activeBoss: null,
    };
  }

  const cleanupResult = await clearOldBossIfNeeded(worldId, existingBoss);

  if (!cleanupResult.cleared) {
    return {
      ok: false,
      cleared: false,
      activeBoss: existingBoss,
      message:
        `❌ A boss is already active in **${worldId}**.\n\n` +
        `👹 Current Boss: **${existingBoss.bossName || "Unknown"}**\n` +
        `❤️ HP: **${existingBoss.hp}/${existingBoss.maxHp}**\n\n` +
        `Use \`!s admin removeboss ${worldId}\` first if you want to replace it.`,
    };
  }

  await message.channel
    .send(
      `🧹 Old boss data cleared before summoning a new boss in **${worldId}**.\n\n` +
        `Previous Boss: **${existingBoss.bossName || "Unknown"}**\n` +
        `Previous Status: **${existingBoss.status || "unknown"}**`
    )
    .catch(() => null);

  return {
    ok: true,
    cleared: true,
    activeBoss: null,
  };
}

async function summonBoss(message, worldId, bossInput) {
  const worldConfig = partyConfig.worlds?.[worldId];

  if (!worldConfig) {
    return message.reply(
      `❌ Invalid world ID: **${worldId}**\n\n` +
        `Check your party/world config.`
    );
  }

  if (!worldConfig.bossRaidChannelId) {
    return message.reply(
      `❌ Boss raid channel is missing for **${worldId}**.\n\n` +
        `Please check your party/world config.`
    );
  }

  const bossResult = getBossByTierOrId(bossInput);

  if (!bossResult) {
    return message.reply(
      `❌ Invalid boss tier or boss ID: **${bossInput || "none"}**\n\n` +
        getAvailableBossHelp()
    );
  }

  const cleanupResult = await clearOldBossBeforeSummon(message, worldId);

  if (!cleanupResult.ok) {
    return message.reply(cleanupResult.message);
  }

  const { tier, source } = bossResult;
  const boss = normalizeBossData(bossResult.boss);

  const spawnedAt = new Date();
  const expiresAt = new Date(spawnedAt.getTime() + getBossExpireMs());

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
    spawnedAt,
    expiresAt,

    summonedBy: message.author.id,
    summonSource: source,

    updatedAt: new Date(),
  };

  await db.collection("worldBosses").doc(worldId).set(bossData);

  const announced = await sendBossAnnouncement(
    message.client,
    worldId,
    worldConfig,
    boss
  );

  return message.reply(
    `✅ Boss summoned successfully.\n\n` +
      `👹 Boss: **${boss.name}**\n` +
      `🌍 World: **${worldId}**\n` +
      `🏷️ Tier: **${tier}**\n` +
      `⭐ Level: **Lv.${boss.level}**\n` +
      `❤️ HP: **${boss.hp}/${boss.hp}**\n` +
      `⏳ Expires In: **${bossConfig.bossExpireMinutes || 120} minutes**\n` +
      `🧹 Old Data Cleared: **${cleanupResult.cleared ? "Yes" : "No"}**\n` +
      `📢 Announcement: **${announced ? "Sent" : "Channel not found"}**`
  );
}

async function removeBoss(message, worldId) {
  const worldConfig = partyConfig.worlds?.[worldId];

  if (!worldConfig) {
    return message.reply(
      `❌ Invalid world ID: **${worldId}**\n\n` +
        `Check your party/world config.`
    );
  }

  const activeBoss = await getActiveBoss(worldId);

  if (!activeBoss) {
    return message.reply(`ℹ️ No boss data found in **${worldId}**.`);
  }

  await deleteBossData(worldId);

  const channel = await message.client.channels
    .fetch(worldConfig.bossRaidChannelId)
    .catch(() => null);

  if (channel) {
    await channel
      .send(
        `🧹 **WORLD BOSS REMOVED BY ADMIN**\n\n` +
          `👹 Boss: **${activeBoss.bossName || "Unknown"}**\n` +
          `🌍 World: **${worldId}**`
      )
      .catch(() => null);
  }

  return message.reply(
    `✅ Boss removed from **${worldId}**.\n\n` +
      `👹 Removed Boss: **${activeBoss.bossName || "Unknown"}**\n` +
      `🧹 Boss data and ranking data cleared.`
  );
}

module.exports = async function adminBoss(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();

  if (subCommand === "summonboss") {
    const worldId = String(args[1] || "").toLowerCase();
    const bossInput = String(args[2] || "").toLowerCase();

    if (!worldId || !bossInput) {
      return message.reply(
        "❌ Usage: `!s admin summonboss <world_id> <tier/boss_id>`\n\n" +
          "Examples:\n" +
          "`!s admin summonboss world_1 beginner`\n" +
          "`!s admin summonboss world_1 goblin_king`"
      );
    }

    return summonBoss(message, worldId, bossInput);
  }

  if (subCommand === "removeboss") {
    const worldId = String(args[1] || "").toLowerCase();

    if (!worldId) {
      return message.reply(
        "❌ Usage: `!s admin removeboss <world_id>`\n\n" +
          "Example:\n" +
          "`!s admin removeboss world_1`"
      );
    }

    return removeBoss(message, worldId);
  }

  return message.reply(
    "❌ Unknown boss admin command.\n\n" +
      "Available:\n" +
      "`!s admin summonboss <world_id> <tier/boss_id>`\n" +
      "`!s admin removeboss <world_id>`"
  );
};