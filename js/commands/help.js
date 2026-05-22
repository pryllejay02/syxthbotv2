module.exports = async function helpCommand(message, prefix) {
  return message.reply(`
⚔️ **SYXTH MMORPG COMMANDS**

━━━━━━━━━━━━━━━━━━
🧙 CHARACTER COMMANDS
━━━━━━━━━━━━━━━━━━

\`${prefix} start\`
Create your MMORPG character

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
Buy an item

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
Unequip equipped gear

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
📖 SYSTEM
━━━━━━━━━━━━━━━━━━

\`${prefix} help\`
Show all commands

🌍 Explore worlds, defeat monsters,
collect equipment, and become stronger
in the world of Syxth MMORPG.
`);
};