module.exports = async function helpCommand(message, prefix) {
  return message.reply(`
⚔️ **SYXTH MMORPG COMMANDS**

━━━━━━━━━━━━━━━━━━
🧙 CHARACTER COMMANDS
━━━━━━━━━━━━━━━━━━

\`${prefix} start\`
Create your MMORPG character

🌍 Select World
⚔️ Select Class

Classes:
⚔️ Swordsman
🏹 Archer
🗡️ Assassin
🛡️ Tanker

\`${prefix} profile\`
View profile and combat stats

\`${prefix} character\`
View character equipment

\`${prefix} char\`
Short command for character

━━━━━━━━━━━━━━━━━━
⚔️ BATTLE COMMANDS
━━━━━━━━━━━━━━━━━━

\`${prefix} hunt\`
Find and challenge monsters

\`${prefix} hit\`
Attack the monster

💥 Critical Hit
Chance to deal x2 damage

💨 Dodge
Chance to avoid enemy attacks

🎁 Loot Drops
Lv.5+ monsters can drop equipment

Drop Rates:
🟢 Common: 45%
🔵 Rare: 15%
❌ No Drop: 40%

Loot Rules:
• Monster Lv.5 drops Lv.5 items
• Monster Lv.10 drops Lv.10 items
• Monster Lv.15 drops Lv.15 items
• Rare items have higher randomized stats
• Loot class is randomized

\`${prefix} retreat\`
Escape battle

\`${prefix} rest\`
Recover HP or revive instantly

━━━━━━━━━━━━━━━━━━
🎒 INVENTORY & ITEMS
━━━━━━━━━━━━━━━━━━

\`${prefix} inventory\`
View inventory

\`${prefix} inv\`
Short inventory command

\`${prefix} use <item_id>\`
Use consumable items

Example:
\`${prefix} use hp_potion\`

\`${prefix} sell <item_id> <quantity>\`
Sell item(s) for gold

Examples:
\`${prefix} sell archer_iron_weapon 1\`
\`${prefix} sell archer_iron_weapon all\`

\`${prefix} sell all\`
Sell every sellable item in your inventory

\`${prefix} sell all common\`
Sell all Common items

\`${prefix} sell all rare\`
Sell all Rare items

Sell Notes:
• Starter equipment cannot be sold
• Rare drops sell for more gold
• Use \`${prefix} inv\` to copy the item ID
• Selling all will remove all sellable inventory items

━━━━━━━━━━━━━━━━━━
🏪 SHOP COMMANDS
━━━━━━━━━━━━━━━━━━

\`${prefix} shop\`
Open class shop

\`${prefix} shop <level>\`
View items by level

Example:
\`${prefix} shop 20\`

\`${prefix} buy <item_id> <quantity>\`
Buy item(s)

Example:
\`${prefix} buy hp_potion 5\`
\`${prefix} buy archer_iron_weapon 1\`

Shop Notes:
• Shop sells Common equipment only
• Rare equipment is obtained from monster drops

━━━━━━━━━━━━━━━━━━
🛡️ EQUIPMENT COMMANDS
━━━━━━━━━━━━━━━━━━

\`${prefix} equip <item_id>\`
Equip an item

Example:
\`${prefix} equip archer_iron_weapon\`

\`${prefix} unequip <slot>\`
Remove equipped item

Slots:
\`weapon\`
\`helmet\`
\`armor\`
\`gloves\`
\`pants\`
\`boots\`

Example:
\`${prefix} unequip weapon\`

━━━━━━━━━━━━━━━━━━
📊 STATS INFO
━━━━━━━━━━━━━━━━━━

⚔️ Attack
Increase damage dealt

🛡️ Defense
Reduce incoming damage

❤️ Max HP
Increase survivability

💨 Dodge
Chance to avoid enemy attacks

💥 Crit
Chance to deal x2 damage

━━━━━━━━━━━━━━━━━━
💎 QUALITY INFO
━━━━━━━━━━━━━━━━━━

🟢 Common
Basic equipment quality

🔵 Rare
Stronger equipment with randomized higher stats

━━━━━━━━━━━━━━━━━━
📖 CLASS INFO
━━━━━━━━━━━━━━━━━━

⚔️ Swordsman
Balanced HP, Attack and Defense

🏹 Archer
High Crit and medium Dodge

🗡️ Assassin
Very high Crit and Dodge

🛡️ Tanker
Very high HP and Defense

━━━━━━━━━━━━━━━━━━
📖 SYSTEM
━━━━━━━━━━━━━━━━━━

\`${prefix} help\`
Show all commands

🌍 Explore worlds
⚔️ Defeat monsters
🎁 Hunt for rare loot
🎒 Collect equipment
💰 Sell extra items
🔥 Level up
👑 Become the strongest adventurer
in Syxth MMORPG
`);
};