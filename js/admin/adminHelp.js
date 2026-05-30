module.exports = async function adminHelp(message) {
  return message.reply(`
👑 **SYXTH ADMIN COMMANDS**

━━━━━━━━━━━━━━━━━━

🎁 **Item Commands**
\`!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>\`
Give a generated shop item to a player.

Example:
\`!s admin giveitem @player archer_iron_weapon Rare 1\`

\`!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>\`
Give a generated boss item to a player.

Example:
\`!s admin givebossitem @player beginner Rare 1\`

━━━━━━━━━━━━━━━━━━

🧙 **Player Commands**
\`!s admin givegold @player <amount>\`
Give gold to a player.

\`!s admin setlevel @player <1-99>\`
Set player level and recalculate stats.

\`!s admin heal @player\`
Fully heal a player.

\`!s admin revive @player\`
Revive a defeated player with 50% HP.

\`!s admin inventory @player\`
View inventory summary.

\`!s admin repairroom @player\`
Repair or recreate a missing private MMORPG room.

\`!s admin repairplayer @player\`
Repair missing or outdated player data fields.

━━━━━━━━━━━━━━━━━━

👹 **Boss Commands**
\`!s admin summonboss <world_id> <tier/boss_id>\`
Summon a boss in a specific world by tier or exact boss ID.

Examples:
\`!s admin summonboss world_1 beginner\`
\`!s admin summonboss world_1 goblin_king\`

\`!s admin removeboss <world_id>\`
Remove active boss and boss ranking data from a world.

Example:
\`!s admin removeboss world_1\`

━━━━━━━━━━━━━━━━━━

🧹 **Reset Commands**
\`!s admin resettrade @player\`
Reset active trade records and trade channel.

\`!s admin resetparty @player\`
Reset active party records and party voice channel.

\`!s admin resetbattle @player\`
Reset active monster battle.

\`!s admin resetall @player\`
Reset trade, party, and battle records.

━━━━━━━━━━━━━━━━━━

⚠️ **Admin Notes**
• Use these commands only inside the admin channel.
• Item and gold commands affect player economy.
• Reset commands are useful when a player gets stuck.
• \`repairroom\` fixes players with missing or broken private rooms.
• \`repairplayer\` fixes missing old player fields without deleting progress.
• \`setlevel\` resets EXP to 0 and recalculates stats.
• \`giveitem\` supports Common, Rare, and Legendary.
• \`givebossitem\` supports Rare and Legendary only.
• \`summonboss\` supports tier names and exact boss IDs.
• \`summonboss\` will not replace a valid active boss.
• Old defeated, inactive, or expired boss data is cleared before a new boss is summoned.
• \`removeboss\` deletes both boss data and damage ranking data.
• Player shop purchases are capped at 99 quantity per buy command.

👑 Divine Gods only.
`);
};