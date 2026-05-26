const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");
const bossConfig = require("../data/bossConfig");

const {
  spawnBoss,
  deleteBossData,
  getActiveBoss,
} = require("../services/bossService");

module.exports = async function adminBoss(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();

  if (subCommand === "summonboss") {
    const worldId = String(args[1] || "").toLowerCase();
    const targetBoss = String(args[2] || "").toLowerCase();

    if (!worldId || !targetBoss) {
      return message.reply(
        "❌ Usage:\n`!s admin summonboss world_1 beginner`\n`!s admin summonboss world_1 goblin_king`"
      );
    }

    if (!partyConfig.worlds[worldId]) {
      return message.reply(`❌ World not found: **${worldId}**`);
    }

    const existingBoss = await getActiveBoss(worldId);

    if (existingBoss && existingBoss.status === "active") {
      return message.reply(`❌ ${worldId} already has an active boss.`);
    }

    let tier = targetBoss;

    if (!bossConfig.bosses[tier]) {
      let foundTier = null;

      for (const [tierName, bosses] of Object.entries(bossConfig.bosses)) {
        const foundBoss = bosses.find(
          (boss) => boss.id.toLowerCase() === targetBoss
        );

        if (foundBoss) {
          foundTier = tierName;
          break;
        }
      }

      if (!foundTier) {
        return message.reply(`❌ Boss/tier not found: **${targetBoss}**`);
      }

      tier = foundTier;
    }

    await spawnBoss(message.client, worldId, tier);

    return message.reply(
      `✅ Boss summoned in **${worldId}** using **${targetBoss}**.`
    );
  }

  if (subCommand === "removeboss") {
    const worldId = String(args[1] || "").toLowerCase();

    if (!worldId) {
      return message.reply("❌ Usage: `!s admin removeboss world_1`");
    }

    await deleteBossData(worldId);

    await db
      .collection("worldBosses")
      .doc(worldId)
      .collection("damage")
      .get()
      .then(async (snapshot) => {
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      })
      .catch(() => null);

    return message.reply(`✅ Boss and ranking data removed from **${worldId}**.`);
  }

  return message.reply("❌ Unknown boss admin command.");
};