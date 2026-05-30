module.exports = async function helpCommand(message, prefix) {
  return message.reply(`
⚔️ **SYXTH MMORPG COMMANDS**

🧙 **Character**
\`${prefix}start\` - Create your character
\`${prefix}profile\` - View your full profile, power, stats, kills, and revive status
\`${prefix}character\` / \`${prefix}char\` - View equipped gear

⚔️ **Battle**
\`${prefix}hunt\` - Find a monster
\`${prefix}hit\` - Attack the monster
\`${prefix}retreat\` - Escape from battle
\`${prefix}rest\` - Heal or revive

🎒 **Inventory**
\`${prefix}inventory\` / \`${prefix}inv\` - View all items
\`${prefix}inventory equipment\` - View equipment only
\`${prefix}inventory consumable\` - View consumables only
\`${prefix}inventory common\` - View Common items
\`${prefix}inventory rare\` - View Rare items
\`${prefix}inventory legendary\` - View Legendary items
\`${prefix}use <item_id>\` - Use a consumable item
\`${prefix}sell <item_id> <qty>\` - Sell specific item quantity
\`${prefix}sell <item_id> all\` - Sell all quantity of one item
\`${prefix}sell all\` - Sell all sellable items
\`${prefix}sell all common\` - Sell all Common items
\`${prefix}sell all rare\` - Sell all Rare items
\`${prefix}sell all legendary\` - Sell all Legendary items

🏪 **Shop**
\`${prefix}shop\` - View shop for your nearest available level
\`${prefix}shop <level>\` - View shop by level
\`${prefix}shop <level> weapon\` - View weapons by level
\`${prefix}shop <level> equipment\` - View equipment by level
\`${prefix}shop <level> armor\` - View armor by level
\`${prefix}shop consumable\` - View consumables
\`${prefix}buy <item_id> <qty>\` - Buy an item

🛡️ **Equipment**
\`${prefix}equip <item_id>\` - Equip an item
\`${prefix}unequip <slot>\` - Unequip an item
Slots: \`weapon\`, \`helmet\`, \`armor\`, \`gloves\`, \`pants\`, \`boots\`

👥 **Party**
\`${prefix}party create @player\` - Create party and invite player
\`${prefix}party invite @player\` - Invite another player
\`${prefix}party accept\` - Accept party invitation
\`${prefix}party status\` - View party status
\`${prefix}party leave\` - Leave party
\`${prefix}party disband\` - Disband party as leader

👹 **Boss Raid**
\`${prefix}raid status\` - View active world boss
\`${prefix}raid hit\` - Attack world boss

🤝 **Trading**
\`${prefix}flex <item_id>\` - Show inventory item in trading area
\`${prefix}flex weapon\` - Show equipped weapon in trading area
\`${prefix}flex armor\` - Show equipped armor in trading area
\`${prefix}flex helmet\` - Show equipped helmet in trading area
\`${prefix}trade @player\` - Send trade invite
\`${prefix}trade accept\` - Accept trade invite
\`${prefix}trade decline\` - Decline trade invite
\`${prefix}trade add <item_id> <qty>\` - Add item to trade
\`${prefix}trade remove <item_id>\` - Remove item from trade
\`${prefix}trade gold <amount>\` - Add gold offer
\`${prefix}trade confirm\` - Confirm trade
\`${prefix}trade cancel\` - Cancel trade
\`${prefix}trade status\` - View trade window

🏆 **Leaderboard**
\`${prefix}leaderboard\` / \`${prefix}lb\` - Overall ranking
\`${prefix}leaderboard overall\` - Overall ranking
\`${prefix}leaderboard power\` - Power ranking
\`${prefix}leaderboard level\` - Level ranking
\`${prefix}leaderboard kills\` - Monster kills ranking
\`${prefix}leaderboard gold\` - Gold ranking

🎁 **Loot Quality**
🟢 Common
🔵 Rare
🟠 Legendary

🤖 **Creator Only**
\`${prefix}creator on\` - Turn Auto Hunt on
\`${prefix}creator off\` - Turn Auto Hunt off
\`${prefix}creator status\` - Check Auto Hunt status

🔥 Explore • Hunt • Raid • Trade • Level Up
`);
};