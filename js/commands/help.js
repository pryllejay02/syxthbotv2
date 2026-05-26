module.exports = async function helpCommand(message, prefix) {
  return message.reply(`
⚔️ **SYXTH MMORPG COMMANDS**

🧙 **Character**
\`${prefix}start\` - Create character
\`${prefix}profile\` - View stats
\`${prefix}character\` / \`${prefix}char\` - View equipment

⚔️ **Battle**
\`${prefix}hunt\` - Find monster
\`${prefix}hit\` - Attack
\`${prefix}retreat\` - Escape
\`${prefix}rest\` - Heal/revive

🎒 **Inventory**
\`${prefix}inventory\` / \`${prefix}inv\`
\`${prefix}use <item_id>\`
\`${prefix}sell <item> <qty>\`
\`${prefix}sell all\`
\`${prefix}sell all common\`
\`${prefix}sell all rare\`

🏪 **Shop**
\`${prefix}shop\`
\`${prefix}shop <level>\`
\`${prefix}buy <item> <qty>\`

🛡️ **Equipment**
\`${prefix}equip <item>\`
\`${prefix}unequip <slot>\`

👥 **Party**
\`${prefix}party create @player\`
\`${prefix}party accept\`
\`${prefix}party leave\`

👹 **Boss Raid**
\`${prefix}raid status\`
\`${prefix}raid hit\`

🤝 **Trading**
\`${prefix}flex <item_id>\` - Show item in trading area
\`${prefix}trade @player\` - Send trade invite
\`${prefix}trade accept\`
\`${prefix}trade decline\`
\`${prefix}trade add <item_id> <qty>\`
\`${prefix}trade remove <item_id>\`
\`${prefix}trade gold <amount>\`
\`${prefix}trade confirm\`
\`${prefix}trade cancel\`
\`${prefix}trade status\`

🏆 **Leaderboard**
\`${prefix}leaderboard\` / \`${prefix}lb\`

🎁 **Loot**
🟢 Common
🔵 Rare
🟠 Legendary

🔥 Explore • Hunt • Raid • Trade • Level Up
`);
};