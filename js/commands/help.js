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
(⚔️ Swordsman / 🏹 Archer / 🗡️ Assassin / 🛡️ Tanker)

\`${prefix} profile\`
View your profile and stats

\`${prefix} character\`
View equipped items and gear

\`${prefix} char\`
Short command for character

━━━━━━━━━━━━━━━━━━
⚔️ BATTLE COMMANDS
━━━━━━━━━━━━━━━━━━

\`${prefix} hunt\`
Find and challenge a monster

\`${prefix} hit\`
Attack the monster

💥 Critical Hit
Chance to deal x2 damage

💨 Dodge
Chance to avoid enemy attacks

\`${prefix} retreat\`
Escape from battle

\`${prefix} rest\`
Recover HP or instantly revive

━━━━━━━━━━━━━━━━━━
🎒 INVENTORY & ITEMS
━━━━━━━━━━━━━━━━━━

\`${prefix} inventory\`
View your inventory

\`${prefix} inv\`
Short inventory command

\`${prefix} use <item_id>\`
Use a consumable item

Example:
\`${prefix} use hp_potion\`

━━━━━━━━━━━━━━━━━━
🏪 SHOP COMMANDS
━━━━━━━━━━━━━━━━━━

\`${prefix} shop\`
View item shop

\`${prefix} shop <level>\`
View shop items by level

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
\`${prefix} equip common_knight_sword\`

\`${prefix} unequip <slot>\`
Unequip gear

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
👑 Become the strongest adventurer
in Syxth MMORPG
`);
};