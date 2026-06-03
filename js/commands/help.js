const balanceConfig = require("../data/balanceConfig");

function getMonsterDropText() {
  const rates = balanceConfig.monsterDrop?.rates || {};

  return (
    `🟢 Common: **${Number(rates.common || 0)}%**\n` +
    `🔵 Rare: **${Number(rates.rare || 0)}%**\n` +
    `❌ No Drop: **${Number(rates.none || 0)}%**`
  );
}

function getPetDropText() {
  const commonChance = Number(balanceConfig.pet?.monsterDrop?.commonChance || 0);
  const rareChance = Number(balanceConfig.pet?.bossDrop?.rareChance || 0);
  const legendaryChance = Number(
    balanceConfig.pet?.bossDrop?.legendaryChance || 0
  );

  return (
    `🟢 Common Pet from Monsters: **${commonChance}%**\n` +
    `🔵 Rare Pet from Bosses: **${rareChance}%**\n` +
    `🟠 Legendary Pet from Bosses: **${legendaryChance}%**`
  );
}

function getPetLevelCapText() {
  const caps = balanceConfig.pet?.maxLevelByQuality || {};

  return (
    `🟢 Common Pet Max Level: **${Number(caps.Common || 20)}**\n` +
    `🔵 Rare Pet Max Level: **${Number(caps.Rare || 30)}**\n` +
    `🟠 Legendary Pet Max Level: **${Number(caps.Legendary || 40)}**`
  );
}

module.exports = async function helpCommand(message, prefix) {
  const p = `${prefix} `;

  const maxBuyQuantity = Number(balanceConfig.shop?.maxBuyQuantity || 99);
  const startingGold = Number(balanceConfig.economy?.startingGold || 500);
  const restCost = Number(balanceConfig.economy?.restCost || 100);
  const normalReviveSeconds = Number(balanceConfig.revive?.normalSeconds || 60);
  const freeReviveHpPercent = Number(
    balanceConfig.revive?.freeReviveHpPercent || 50
  );
  const monsterDropMinLevel = Number(balanceConfig.monsterDrop?.minLevel || 5);
  const petDropMinLevel = Number(balanceConfig.pet?.monsterDrop?.minLevel || 5);
  const maxLevel = Number(
    balanceConfig.MAX_LEVEL || balanceConfig.maxLevel || 99
  );

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
    `📌 Max buy quantity: **${maxBuyQuantity}** per command\n\n` +

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
    `🐾 **Pets**\n` +
    `\`${p}pet\` - View your active pet\n` +
    `\`${p}pet help\` - View pet command guide\n` +
    `\`${p}pet list\` - View all pets\n` +
    `\`${p}pet list <filter>\` - View pets by filter\n` +
    `\`${p}pet list <filter> <page>\` - View filtered pets by page\n` +
    `\`${p}pet info <pet_id>\` - View full pet details\n` +
    `\`${p}pet equip <pet_id>\` - Set active pet\n` +
    `\`${p}pet unequip\` - Remove active pet\n` +
    `\`${p}pet lock <pet_id>\` - Lock pet from selling/trading\n` +
    `\`${p}pet unlock <pet_id>\` - Unlock pet\n` +
    `\`${p}pet sell <pet_id>\` - Sell one unlocked pet\n` +
    `\`${p}pet sell all common\` - Sell all unlocked Common pets\n` +
    `\`${p}pet sell all rare\` - Sell all unlocked Rare pets\n` +
    `\`${p}pet sell all legendary\` - Sell all unlocked Legendary pets\n\n` +

    `📌 **Pet Filters**\n` +
    `\`all\`, \`active\`, \`locked\`, \`unlocked\`, \`common\`, \`rare\`, \`legendary\`, ` +
    `\`attack\`, \`tank\`, \`support\`, \`critical\`, \`evasion\`, \`balanced\`\n\n` +

    `📌 **Pet Rules**\n` +
    `Pets are not buyable.\n` +
    `Pets cannot be renamed.\n` +
    `Pets have no skills.\n` +
    `Pets give passive stats only.\n` +
    `Only active pets gain EXP.\n` +
    `Locked pets cannot be sold or traded.\n` +
    `Active pets cannot be sold or traded.`;

  const page4 =
    `🤝 **Trading**\n` +
    `\`${p}flex <item_id>\` - Show inventory item in trading area\n` +
    `\`${p}flex weapon\` - Show equipped weapon in trading area\n` +
    `\`${p}flex armor\` - Show equipped armor in trading area\n` +
    `\`${p}flex helmet\` - Show equipped helmet in trading area\n` +
    `\`${p}flex pet <pet_id>\` - Show owned pet in trading area\n` +
    `\`${p}trade @player\` - Send trade invite\n` +
    `\`${p}trade accept\` - Accept trade invite\n` +
    `\`${p}trade decline\` - Decline trade invite\n` +
    `\`${p}trade add <item_id> <qty>\` - Add item to trade\n` +
    `\`${p}trade remove <item_id>\` - Remove item from trade\n` +
    `\`${p}trade addpet <pet_id>\` - Add unlocked pet to trade\n` +
    `\`${p}trade removepet <pet_id>\` - Remove pet from trade\n` +
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

  const page5 =
    `🎁 **Loot Quality**\n` +
    `🟢 Common\n` +
    `🔵 Rare\n` +
    `🟠 Legendary\n\n` +

    `📦 **Monster Item Drops**\n` +
    `Item drops start from monster **Lv.${monsterDropMinLevel}+**\n` +
    `${getMonsterDropText()}\n\n` +

    `🐾 **Pet Drops**\n` +
    `Common pet drops start from monster **Lv.${petDropMinLevel}+**\n` +
    `${getPetDropText()}\n\n` +

    `🐾 **Pet Level Caps**\n` +
    `${getPetLevelCapText()}\n\n` +

    `📈 **Progression**\n` +
    `Max Player Level: **${maxLevel}**\n` +
    `Monster EXP and Gold scale by monster level.\n` +
    `Starting Gold: **${startingGold} Gold**\n\n` +

    `❤️ **Rest / Revive**\n` +
    `Rest or instant revive cost: **${restCost} Gold**\n` +
    `Free revive timer: **${normalReviveSeconds}s**\n` +
    `Free revive HP: **${freeReviveHpPercent}%**\n\n` +

    `🔥 Explore • Hunt • Raid • Trade • Collect Pets • Level Up`;

  await message.reply(page1);
  await message.channel.send(page2);
  await message.channel.send(page3);
  await message.channel.send(page4);
  return message.channel.send(page5);
};