module.exports = async function helpCommand(message, prefix) {
  return message.reply(`
⚔️ **SYXTH MMORPG COMMANDS**

🧙 **Character**
\`${prefix}start\` - Create character
\`${prefix}profile\` - View profile/stats
\`${prefix}character\` / \`${prefix}char\` - View equipment

⚔️ **Battle**
\`${prefix}hunt\` - Find monsters
\`${prefix}hit\` - Attack monster
\`${prefix}retreat\` - Escape battle
\`${prefix}rest\` - Heal or revive

🎒 **Inventory**
\`${prefix}inventory\` / \`${prefix}inv\` - View items
\`${prefix}use <item_id>\` - Use consumable
\`${prefix}sell <item_id> <qty>\` - Sell item
\`${prefix}sell <item_id> all\` - Sell all quantity of item
\`${prefix}sell all\` - Sell all sellable items
\`${prefix}sell all common\` - Sell all Common items
\`${prefix}sell all rare\` - Sell all Rare items

🏪 **Shop**
\`${prefix}shop\` - Open shop
\`${prefix}shop <level>\` - View level shop
\`${prefix}buy <item_id> <qty>\` - Buy item

🛡️ **Equipment**
\`${prefix}equip <item_id>\` - Equip item
\`${prefix}unequip <slot>\` - Unequip item
Slots: \`weapon\`, \`helmet\`, \`armor\`, \`gloves\`, \`pants\`, \`boots\`

🏆 **Leaderboard**
\`${prefix}leaderboard\` / \`${prefix}lb\` - View rankings

🎁 **Loot**
Lv.5+ monsters can drop equipment.
🟢 Common, 🔵 Rare, ❌ No Drop

📖 **Examples**
\`${prefix}shop 5\`
\`${prefix}buy archer_iron_weapon 1\`
\`${prefix}equip archer_iron_weapon\`
\`${prefix}sell all common\`
`);
};