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

🏆 **Leaderboard**
\`${prefix}leaderboard\` / \`${prefix}lb\`

🎁 **Loot**
🟢 Common
🔵 Rare
🟠 Legendary

🔥 Explore • Hunt • Raid • Level Up
`);
};