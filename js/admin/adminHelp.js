const balanceConfig = require("../data/balanceConfig");

function getMonsterDropText() {
  const rates = balanceConfig.monsterDrop?.rates || {};

  return (
    `Rare: **${Number(rates.rare || 0)}%**, ` +
    `Common: **${Number(rates.common || 0)}%**, ` +
    `No Drop: **${Number(rates.none || 0)}%**`
  );
}

module.exports = async function adminHelp(message) {
  const maxLevel = Number(balanceConfig.MAX_LEVEL || balanceConfig.maxLevel || 99);
  const maxBuyQuantity = Number(balanceConfig.shop?.maxBuyQuantity || 99);
  const maxAdminItemQuantity = Number(balanceConfig.adminItem?.maxQuantity || 50);
  const startingGold = Number(balanceConfig.economy?.startingGold || 500);
  const restCost = Number(balanceConfig.economy?.restCost || 100);
  const normalReviveSeconds = Number(balanceConfig.revive?.normalSeconds || 60);
  const raidReviveSeconds = Number(balanceConfig.revive?.raidSeconds || 15);
  const freeReviveHpPercent = Number(balanceConfig.revive?.freeReviveHpPercent || 50);
  const raidReviveHpPercent = Number(balanceConfig.revive?.raidReviveHpPercent || 50);
  const monsterDropMinLevel = Number(balanceConfig.monsterDrop?.minLevel || 5);
  const scalePerTier = Number(balanceConfig.item?.scalePerTier || 0.85);

  const page1 =
    `👑 **SYXTH ADMIN COMMANDS**\n\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +

    `🎁 **Item Commands**\n` +
    `\`!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>\`\n` +
    `Give a generated shop item to a player.\n` +
    `Max Qty: **${maxAdminItemQuantity}**\n\n` +
    `Example:\n` +
    `\`!s admin giveitem @player archer_iron_weapon Rare 1\`\n\n` +

    `\`!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>\`\n` +
    `Give a generated boss item to a player.\n` +
    `Max Qty: **${maxAdminItemQuantity}**\n\n` +
    `Example:\n` +
    `\`!s admin givebossitem @player beginner Rare 1\`\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +

    `🧙 **Player Commands**\n` +
    `\`!s admin givegold @player <amount>\`\n` +
    `Give gold to a player.\n\n` +

    `\`!s admin setlevel @player <1-${maxLevel}>\`\n` +
    `Set player level, reset EXP to 0, and recalculate stats.\n\n` +

    `\`!s admin heal @player\`\n` +
    `Fully heal a player.\n\n` +

    `\`!s admin revive @player\`\n` +
    `Revive a defeated player using the revive HP percentage from balance config.\n\n` +

    `\`!s admin inventory @player\`\n` +
    `View inventory summary.`;

  const page2 =
    `🛠️ **Player Repair Commands**\n` +
    `\`!s admin repairroom @player\`\n` +
    `Repair or recreate a missing private MMORPG room.\n\n` +

    `\`!s admin repairplayer @player\`\n` +
    `Repair missing or outdated player data fields without deleting progress.\n` +
    `Also recalculates stats using current class, level, equipment, and balance config.\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +

    `👹 **Boss Commands**\n` +
    `\`!s admin summonboss <world_id> <tier/boss_id>\`\n` +
    `Summon a boss in a specific world by tier or exact boss ID.\n\n` +
    `Examples:\n` +
    `\`!s admin summonboss world_1 beginner\`\n` +
    `\`!s admin summonboss world_1 goblin_king\`\n\n` +

    `\`!s admin removeboss <world_id>\`\n` +
    `Remove active boss and boss ranking data from a world.\n\n` +
    `Example:\n` +
    `\`!s admin removeboss world_1\`\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +

    `⚖️ **Current Balance Values**\n` +
    `Starting Gold: **${startingGold} Gold**\n` +
    `Rest / Instant Revive Cost: **${restCost} Gold**\n` +
    `Normal Revive Timer: **${normalReviveSeconds}s**\n` +
    `Raid Revive Timer: **${raidReviveSeconds}s**\n` +
    `Normal Revive HP: **${freeReviveHpPercent}%**\n` +
    `Raid Revive HP: **${raidReviveHpPercent}%**\n` +
    `Monster Drops Start: **Lv.${monsterDropMinLevel}**\n` +
    `Monster Drop Rates: ${getMonsterDropText()}\n` +
    `Item Tier Scale: **${scalePerTier} per tier**`;

  const page3 =
    `🧹 **Reset Commands**\n` +
    `\`!s admin resettrade @player\`\n` +
    `Reset active trade records and trade channel.\n\n` +

    `\`!s admin resetparty @player\`\n` +
    `Reset active party records and party voice channel.\n\n` +

    `\`!s admin resetbattle @player\`\n` +
    `Reset active monster battle.\n\n` +

    `\`!s admin resetall @player\`\n` +
    `Reset trade, party, and battle records.\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +

    `⚠️ **Admin Notes**\n` +
    `• Use these commands only inside the admin channel.\n` +
    `• Item and gold commands affect player economy.\n` +
    `• Reset commands are useful when a player gets stuck.\n` +
    `• \`repairroom\` fixes players with missing or broken private rooms.\n` +
    `• \`repairplayer\` fixes missing old player fields without deleting progress.\n` +
    `• \`setlevel\` resets EXP to 0 and recalculates stats from balance config.\n` +
    `• Normal monster EXP and Gold now use the formula in \`balanceConfig.monsterRewards\`.\n` +
    `• Fixed monster EXP/Gold only applies when a monster has \`rewardOverride: true\`.\n` +
    `• \`giveitem\` supports Common, Rare, and Legendary.\n` +
    `• \`givebossitem\` supports Rare and Legendary only.\n` +
    `• Admin item quantity is capped at **${maxAdminItemQuantity}** per command.\n` +
    `• Player shop purchases are capped at **${maxBuyQuantity}** per buy command.\n` +
    `• Rest and instant revive cost is currently **${restCost} Gold**.\n` +
    `• \`summonboss\` supports tier names and exact boss IDs.\n` +
    `• \`summonboss\` will not replace a valid active boss.\n` +
    `• Old defeated, inactive, or expired boss data is cleared before a new boss is summoned.\n` +
    `• \`removeboss\` deletes both boss data and damage ranking data.\n\n` +
    `👑 Divine Gods only.`;

  await message.reply(page1);
  await message.channel.send(page2);
  return message.channel.send(page3);
};