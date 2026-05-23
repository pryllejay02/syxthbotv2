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

━━━━━━━━━━━━━━━━━━
🛡️ EQUIPMENT COMMANDS
━━━━━━━━━━━━━━━━━━

\`${prefix} equip <item_id>\`
Equip an item

Example:

\`${prefix} equip swordsman_weapon_1\`

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
🎒 Collect equipment
🔥 Level up
👑 Become the strongest adventurer
in Syxth MMORPG
`);
};