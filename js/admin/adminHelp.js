module.exports = async function adminHelp(message) {
  const page1 =
    `👑 **SYXTH ADMIN COMMANDS**\n\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +

    `🎁 **Item Commands**\n` +
    `\`!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>\`\n` +
    `Give a generated shop item to a player.\n\n` +
    `Example:\n` +
    `\`!s admin giveitem @player archer_iron_weapon Rare 1\`\n\n` +

    `\`!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>\`\n` +
    `Give a generated boss item to a player.\n\n` +
    `Example:\n` +
    `\`!s admin givebossitem @player beginner Rare 1\`\n\n` +

    `━━━━━━━━━━━━━━━━━━\n\n` +

    `🧙 **Player Commands**\n` +
    `\`!s admin givegold @player <amount>\`\n` +
    `Give gold to a player.\n\n` +
    `\`!s admin setlevel @player <1-99>\`\n` +
    `Set player level and recalculate stats.\n\n` +
    `\`!s admin heal @player\`\n` +
    `Fully heal a player.\n\n` +
    `\`!s admin revive @player\`\n` +
    `Revive a defeated player with 50% HP.\n\n` +
    `\`!s admin inventory @player\`\n` +
    `View inventory summary.`;

  const page2 =
    `🧙 **Player Repair Commands**\n` +
    `\`!s admin repairroom @player\`\n` +
    `Repair or recreate a missing private MMORPG room.\n\n` +
    `\`!s admin repairplayer @player\`\n` +
    `Repair missing or outdated player data fields.\n\n` +

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
    `\`!s admin removeboss world_1\``;

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
    `• \`setlevel\` resets EXP to 0 and recalculates stats.\n` +
    `• \`giveitem\` supports Common, Rare, and Legendary.\n` +
    `• \`givebossitem\` supports Rare and Legendary only.\n` +
    `• \`summonboss\` supports tier names and exact boss IDs.\n` +
    `• \`summonboss\` will not replace a valid active boss.\n` +
    `• Old defeated, inactive, or expired boss data is cleared before a new boss is summoned.\n` +
    `• \`removeboss\` deletes both boss data and damage ranking data.\n` +
    `• Player shop purchases are capped at 99 quantity per buy command.\n\n` +
    `👑 Divine Gods only.`;

  await message.reply(page1);
  await message.channel.send(page2);
  return message.channel.send(page3);
};