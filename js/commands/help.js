module.exports = async function helpCommand(message, prefix) {
  const p = `${prefix} `;

  const page1 =
    `⚔️ **SYXTH MMORPG COMMANDS**\n\n` +
    `🧙 **Character**\n` +
    `\`${p}start\` - Create your character\n` +
    `\`${p}profile\` - View your full profile, power, stats, kills, and revive status\n` +
    `\`${p}character\` / \`${p}char\` - View equipped gear\n\n` +

    `⚔️ **Battle**\n` +
    `\`${p}hunt\` - Find a monster\n` +
    `\`${p}hit\` - Attack the monster\n` +
    `\`${p}retreat\` - Escape from battle\n` +
    `\`${p}rest\` - Heal or revive\n\n` +

    `🎒 **Inventory**\n` +
    `\`${p}inventory\` / \`${p}inv\` - View all items\n` +
    `\`${p}inventory equipment\` - View equipment only\n` +
    `\`${p}inventory consumable\` - View consumables only\n` +
    `\`${p}inventory common\` - View Common items\n` +
    `\`${p}inventory rare\` - View Rare items\n` +
    `\`${p}inventory legendary\` - View Legendary items\n` +
    `\`${p}use <item_id>\` - Use a consumable item\n\n` +

    `💰 **Selling**\n` +
    `\`${p}sell <item_id> <qty>\` - Sell specific item quantity\n` +
    `\`${p}sell <item_id> all\` - Sell all quantity of one item\n` +
    `\`${p}sell all\` - Sell all sellable items\n` +
    `\`${p}sell all common\` - Sell all Common items\n` +
    `\`${p}sell all rare\` - Sell all Rare items\n` +
    `\`${p}sell all legendary\` - Sell all Legendary items`;

  const page2 =
    `🏪 **Shop**\n` +
    `\`${p}shop\` - View shop for your nearest available level\n` +
    `\`${p}shop <level>\` - View shop by level\n` +
    `\`${p}shop <level> weapon\` - View weapons by level\n` +
    `\`${p}shop <level> equipment\` - View equipment by level\n` +
    `\`${p}shop <level> armor\` - View armor by level\n` +
    `\`${p}shop consumable\` - View consumables\n` +
    `\`${p}buy <item_id> <qty>\` - Buy an item\n` +
    `📌 Max buy quantity: **99** per command\n\n` +

    `🛡️ **Equipment**\n` +
    `\`${p}equip <item_id>\` - Equip an item\n` +
    `\`${p}unequip <slot>\` - Unequip an item\n` +
    `Slots: \`weapon\`, \`helmet\`, \`armor\`, \`gloves\`, \`pants\`, \`boots\`\n\n` +

    `👥 **Party**\n` +
    `\`${p}party create @player\` - Create party and invite player\n` +
    `\`${p}party invite @player\` - Invite another player\n` +
    `\`${p}party accept\` - Accept party invitation\n` +
    `\`${p}party status\` - View party status\n` +
    `\`${p}party leave\` - Leave party\n` +
    `\`${p}party disband\` - Disband party as leader\n\n` +

    `👹 **Boss Raid**\n` +
    `\`${p}raid status\` - View active world boss\n` +
    `\`${p}raid hit\` - Attack world boss`;

  const page3 =
    `🤝 **Trading**\n` +
    `\`${p}flex <item_id>\` - Show inventory item in trading area\n` +
    `\`${p}flex weapon\` - Show equipped weapon in trading area\n` +
    `\`${p}flex armor\` - Show equipped armor in trading area\n` +
    `\`${p}flex helmet\` - Show equipped helmet in trading area\n` +
    `\`${p}trade @player\` - Send trade invite\n` +
    `\`${p}trade accept\` - Accept trade invite\n` +
    `\`${p}trade decline\` - Decline trade invite\n` +
    `\`${p}trade add <item_id> <qty>\` - Add item to trade\n` +
    `\`${p}trade remove <item_id>\` - Remove item from trade\n` +
    `\`${p}trade gold <amount>\` - Add gold offer\n` +
    `\`${p}trade confirm\` - Confirm trade\n` +
    `\`${p}trade cancel\` - Cancel trade\n` +
    `\`${p}trade status\` - View trade window\n\n` +

    `🏆 **Leaderboard**\n` +
    `\`${p}leaderboard\` / \`${p}lb\` - Overall ranking\n` +
    `\`${p}leaderboard overall\` - Overall ranking\n` +
    `\`${p}leaderboard power\` - Power ranking\n` +
    `\`${p}leaderboard level\` - Level ranking\n` +
    `\`${p}leaderboard kills\` - Monster kills ranking\n` +
    `\`${p}leaderboard gold\` - Gold ranking`;

  const page4 =
    `🎁 **Loot Quality**\n` +
    `🟢 Common\n` +
    `🔵 Rare\n` +
    `🟠 Legendary\n\n` +

    `🤖 **Creator Only**\n` +
    `\`${p}creator on\` - Turn Auto Hunt on\n` +
    `\`${p}creator off\` - Turn Auto Hunt off\n` +
    `\`${p}creator status\` - Check Auto Hunt status\n\n` +

    `🔥 Explore • Hunt • Raid • Trade • Level Up`;

  await message.reply(page1);
  await message.channel.send(page2);
  await message.channel.send(page3);
  return message.channel.send(page4);
};