module.exports = async function adminHelp(message) {
  return message.reply(`
🛠️ **SYXTH ADMIN TOOL V2**

\`!s admin givegold @player <amount>\`
\`!s admin giveitem @player <item_id> <Common/Rare/Legendary> <qty>\`
\`!s admin givebossitem @player <boss_id/tier> <Rare/Legendary> <qty>\`
\`!s admin setlevel @player <level>\`
\`!s admin heal @player\`
\`!s admin revive @player\`
\`!s admin inventory @player\`

👹 **Boss**
\`!s admin summonboss <world> <tier/boss_id>\`
\`!s admin removeboss <world>\`

♻️ **Reset**
\`!s admin resettrade @player\`
\`!s admin resetparty @player\`
`);
};