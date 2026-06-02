const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");

const {
  getReviveRemainingSeconds,
  resolvePlayerRevive,
} = require("../utils/reviveSystem");

const { calculateTotalStats } = require("../utils/statSystem");
const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");

const EQUIPMENT_SLOTS = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "pants",
  "boots",
];

function getDefaultEquipment() {
  return {
    weapon: null,
    helmet: null,
    armor: null,
    gloves: null,
    pants: null,
    boots: null,
  };
}

function getDefaultStats() {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
    dodge: 0,
    crit: 0,
  };
}

function getStarterWeaponByClass(classId) {
  const weapons = {
    swordsman: {
      name: "Wooden Sword",
      emoji: "🗡️",
    },

    archer: {
      name: "Wooden Bow",
      emoji: "🏹",
    },

    assassin: {
      name: "Training Dagger",
      emoji: "🗡️",
    },

    tanker: {
      name: "Wooden Shield",
      emoji: "🛡️",
    },
  };

  return weapons[classId] || weapons.swordsman;
}

function getStarterWeaponItem(classId = "swordsman") {
  const starterWeapon = getStarterWeaponByClass(classId);

  return {
    id: `${classId}_starter_weapon`,
    baseItemId: `${classId}_starter_weapon`,
    name: starterWeapon.name,
    type: "Weapon",
    quality: "Starter",
    qualityEmoji: "🌱",
    requiredLevel: 1,
    compatibleClasses: [classId],
    price: 0,
    description: "Starter weapon.",
    source: "starter",
    isStarter: true,
    quantity: 1,
    stats: getDefaultStats(),
    emoji: starterWeapon.emoji,
  };
}

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
}

function getQuality(item = {}) {
  const quality = String(item.quality || "Common");

  if (["Starter", "Common", "Rare", "Legendary"].includes(quality)) {
    return quality;
  }

  return "Common";
}

function getSource(item = {}) {
  return String(item.source || "shop").toLowerCase();
}

function isStarterItem(item = {}) {
  return (
    item.quality === "Starter" ||
    item.source === "starter" ||
    item.isStarter === true
  );
}

function isConsumable(item = {}) {
  return String(item.type || "").toLowerCase() === "consumable";
}

function findBaseShopItem(item = {}) {
  const candidateIds = [item.baseItemId, item.id]
    .filter(Boolean)
    .map(normalizeId);

  for (const candidateId of candidateIds) {
    const exactMatch = shopItems.find(
      (shopItem) => normalizeId(shopItem.id) === candidateId
    );

    if (exactMatch) return exactMatch;
  }

  const itemId = normalizeId(item.id);

  if (!itemId) return null;

  const prefixMatches = shopItems
    .filter((shopItem) => itemId.startsWith(normalizeId(shopItem.id)))
    .sort((a, b) => normalizeId(b.id).length - normalizeId(a.id).length);

  return prefixMatches[0] || null;
}

function getRollConfigBySource(item = {}, quality = "Common") {
  const source = getSource(item);

  if (source === "boss_raid") {
    return balanceConfig.bossDrop?.statRolls?.[quality] || null;
  }

  if (source === "monster_drop") {
    return balanceConfig.monsterDrop?.statRolls?.[quality] || null;
  }

  if (source === "admin_generated" || source === "admin") {
    return balanceConfig.adminItem?.statRolls?.[quality] || null;
  }

  return null;
}

function getDeterministicMultiplier(item = {}, quality = "Common") {
  if (quality === "Starter") return 0;

  const source = getSource(item);

  if (!source || source === "shop") {
    return Number(balanceConfig.quality?.[quality]?.statMultiplier || 1);
  }

  const rollConfig = getRollConfigBySource(item, quality);

  if (rollConfig) {
    const min = Number(rollConfig.min || 1);
    const max = Number(rollConfig.max || min);

    return Number(((min + max) / 2).toFixed(3));
  }

  return Number(balanceConfig.quality?.[quality]?.statMultiplier || 1);
}

function getPriceMultiplierBySource(item = {}, quality = "Common") {
  const source = getSource(item);

  if (source === "boss_raid") {
    return Number(balanceConfig.bossDrop?.priceMultiplier?.[quality] || 1);
  }

  if (source === "monster_drop") {
    return Number(balanceConfig.monsterDrop?.priceMultiplier?.[quality] || 1);
  }

  if (source === "admin_generated" || source === "admin") {
    return Number(
      balanceConfig.adminItem?.priceMultiplier?.[quality] ||
        balanceConfig.quality?.[quality]?.priceMultiplier ||
        1
    );
  }

  return Number(balanceConfig.quality?.[quality]?.priceMultiplier || 1);
}

function capPercentStat(statName, value, quality = "Common", source = "shop") {
  const statValue = Number(value || 0);

  if (typeof balanceConfig.capItemPercentStat === "function") {
    return balanceConfig.capItemPercentStat(
      statName,
      statValue,
      quality,
      source
    );
  }

  let cap = Number(balanceConfig.item?.statCaps?.[statName] || 0);

  if (source === "monster_drop") {
    cap = Number(
      balanceConfig.monsterDrop?.statCaps?.[quality]?.[statName] || cap
    );
  }

  if (source === "boss_raid") {
    cap = Number(
      balanceConfig.bossDrop?.statCaps?.[quality]?.[statName] || cap
    );
  }

  if (source === "admin_generated" || source === "admin") {
    if (quality === "Rare") {
      cap = Number(
        balanceConfig.monsterDrop?.statCaps?.Rare?.[statName] || cap
      );
    }

    if (quality === "Legendary") {
      cap = Number(
        balanceConfig.bossDrop?.statCaps?.Legendary?.[statName] || cap
      );
    }
  }

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function scaleStats(
  stats = {},
  multiplier = 1,
  quality = "Common",
  source = "shop"
) {
  return {
    attack: Math.floor(Number(stats.attack || 0) * multiplier),
    defense: Math.floor(Number(stats.defense || 0) * multiplier),
    maxHp: Math.floor(Number(stats.maxHp || 0) * multiplier),

    dodge: capPercentStat(
      "dodge",
      Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
      quality,
      source
    ),

    crit: capPercentStat(
      "crit",
      Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
      quality,
      source
    ),
  };
}

function normalizeFallbackStats(item = {}) {
  const quality = getQuality(item);
  const source = getSource(item);

  return {
    attack: Math.floor(Number(item.stats?.attack || 0)),
    defense: Math.floor(Number(item.stats?.defense || 0)),
    maxHp: Math.floor(Number(item.stats?.maxHp || 0)),

    dodge: capPercentStat(
      "dodge",
      Number(item.stats?.dodge || 0),
      quality,
      source
    ),

    crit: capPercentStat(
      "crit",
      Number(item.stats?.crit || 0),
      quality,
      source
    ),
  };
}

function getCleanItemName(baseName = "Unknown Item", quality = "Common") {
  const cleanBaseName = String(baseName || "Unknown Item").replace(
    /^(Common|Rare|Legendary|Starter)\s+/i,
    ""
  );

  if (quality === "Starter") {
    return cleanBaseName;
  }

  return `${quality} ${cleanBaseName}`;
}

function makeDescription(stats = {}) {
  const parts = [];

  if (stats.attack) parts.push(`+${stats.attack} ATK`);
  if (stats.defense) parts.push(`+${stats.defense} DEF`);
  if (stats.maxHp) parts.push(`+${stats.maxHp} HP`);
  if (stats.dodge) parts.push(`+${stats.dodge}% Dodge`);
  if (stats.crit) parts.push(`+${stats.crit}% Crit`);

  return parts.length ? parts.join(", ") : "No bonus stats";
}

function rebalanceItemStats(item = {}) {
  if (!item) return null;

  const quality = getQuality(item);
  const source = getSource(item);
  const baseItem = findBaseShopItem(item);

  if (isStarterItem(item)) {
    return {
      ...item,
      quality: "Starter",
      qualityEmoji: "🌱",
      price: 0,
      source: "starter",
      isStarter: true,
      quantity: 1,
      stats: getDefaultStats(),
      description: item.description || "Starter weapon.",
    };
  }

  if (isConsumable(item)) {
    const sourceItem = baseItem || item;

    return {
      ...item,

      id: item.id || sourceItem.id,
      baseItemId: sourceItem.baseItemId || sourceItem.id || item.baseItemId,

      name: sourceItem.name || item.name || "Unknown Consumable",
      type: sourceItem.type || item.type || "Consumable",

      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),

      requiredLevel: Number(sourceItem.requiredLevel || item.requiredLevel || 1),
      compatibleClasses:
        sourceItem.compatibleClasses || item.compatibleClasses || ["all"],

      price: Math.max(0, Math.floor(Number(sourceItem.price || item.price || 0))),

      description:
        sourceItem.description || item.description || "Consumable item.",

      quantity: Math.max(1, Number(item.quantity || 1)),

      stats: getDefaultStats(),

      healPercent: Number(sourceItem.healPercent || item.healPercent || 0),
      healAmount: Number(
        sourceItem.healAmount ||
          sourceItem.heal ||
          item.healAmount ||
          item.heal ||
          0
      ),

      source: item.source || "shop",
      emoji: sourceItem.emoji || item.emoji || "🧪",
    };
  }

  if (!baseItem) {
    const fallbackStats = normalizeFallbackStats(item);

    return {
      ...item,
      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),
      quantity: 1,
      stats: fallbackStats,
      description: makeDescription(fallbackStats),
    };
  }

  const multiplier = getDeterministicMultiplier(item, quality);

  const rebalancedStats = scaleStats(
    baseItem.stats || getDefaultStats(),
    multiplier,
    quality,
    source
  );

  const priceMultiplier = getPriceMultiplierBySource(item, quality);

  return {
    ...item,

    id: item.id || baseItem.id,
    baseItemId: baseItem.id,

    name:
      source === "shop"
        ? baseItem.name
        : getCleanItemName(baseItem.name, quality),

    type: baseItem.type || item.type || "Unknown",

    quality,
    qualityEmoji: getQualityEmoji(quality),

    requiredLevel: Number(baseItem.requiredLevel || item.requiredLevel || 1),
    compatibleClasses:
      baseItem.compatibleClasses || item.compatibleClasses || ["all"],

    price: Math.floor(
      Number(baseItem.price || item.price || 0) * priceMultiplier
    ),

    description: makeDescription(rebalancedStats),

    stats: rebalancedStats,

    emoji: baseItem.emoji || item.emoji || "📦",

    quantity: 1,
    source,
  };
}

function normalizeEquipmentSlot(item) {
  if (!item) return null;

  const normalizedItem = rebalanceItemStats(item);

  if (!normalizedItem) return null;
  if (isConsumable(normalizedItem)) return null;

  return {
    ...normalizedItem,
    quantity: 1,
  };
}

function normalizeEquipment(player = {}) {
  const classId = player.classId || "swordsman";

  const safeEquipment = {
    ...getDefaultEquipment(),
    ...(player.equipment || {}),
  };

  const equipment = getDefaultEquipment();

  EQUIPMENT_SLOTS.forEach((slot) => {
    equipment[slot] = normalizeEquipmentSlot(safeEquipment[slot]);
  });

  if (!equipment.weapon) {
    equipment.weapon = getStarterWeaponItem(classId);
  }

  return equipment;
}

function normalizeInventory(inventory = []) {
  if (!Array.isArray(inventory)) return [];

  return inventory
    .filter(Boolean)
    .map((item) => rebalanceItemStats(item))
    .filter(Boolean);
}

function getBaseStatsByClassLevel(classId, level) {
  if (typeof balanceConfig.getBaseStatsByClassLevel === "function") {
    return balanceConfig.getBaseStatsByClassLevel(classId, level);
  }

  return {
    attack: 10,
    defense: 5,
    maxHp: 100,
    dodge: 0,
    crit: 0,
  };
}

function getRebalancedPlayer(player = {}) {
  const level = Math.max(1, Number(player.level || 1));
  const classId = player.classId || "swordsman";

  const baseStats = getBaseStatsByClassLevel(classId, level);

  const equipment = normalizeEquipment({
    ...player,
    classId,
  });

  const inventory = normalizeInventory(player.inventory || []);
  const totalStats = calculateTotalStats(baseStats, equipment);

  const hp = Math.min(
    Math.max(0, Number(player.hp ?? totalStats.maxHp)),
    Number(totalStats.maxHp || 100)
  );

  return {
    ...player,

    level,
    classId,

    baseStats,
    equipment,
    inventory,

    hp,
    maxHp: totalStats.maxHp,
    attack: totalStats.attack,
    defense: totalStats.defense,
    dodge: totalStats.dodge,
    crit: totalStats.crit,
  };
}

function calculatePower(player) {
  if (typeof balanceConfig.calculatePower === "function") {
    return balanceConfig.calculatePower(player);
  }

  return Math.floor(
    Number(player.attack || 0) +
      Number(player.defense || 0) * 1.5 +
      Number(player.maxHp || 0) * 0.2 +
      Number(player.dodge || 0) * 10 +
      Number(player.crit || 0) * 10 +
      Number(player.level || 1) * 100
  );
}

function calculateOverallScore(player) {
  if (typeof balanceConfig.calculateOverallScore === "function") {
    return balanceConfig.calculateOverallScore(player);
  }

  return calculatePower(player) + Number(player.monsterKills || 0) * 3;
}

function countEquippedItems(equipment = {}) {
  return Object.values(equipment).filter(Boolean).length;
}

function formatStats(stats = {}) {
  const parts = [];

  if (stats.attack) parts.push(`⚔️ ATK ${stats.attack}`);
  if (stats.defense) parts.push(`🛡️ DEF ${stats.defense}`);
  if (stats.maxHp) parts.push(`❤️ HP ${stats.maxHp}`);
  if (stats.dodge) parts.push(`💨 Dodge ${stats.dodge}%`);
  if (stats.crit) parts.push(`💥 Crit ${stats.crit}%`);

  return parts.length ? parts.join(" • ") : "No bonus stats";
}

function formatClass(classes = []) {
  if (!Array.isArray(classes)) return "All";

  return classes
    .map((cls) => {
      const text = String(cls || "all");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(", ");
}

function showEquipment(item, emptyText) {
  if (!item) {
    return (
      `*Empty ${emptyText}*\n` +
      `└ Equip using \`!s equip <item_id>\``
    );
  }

  const qualityEmoji =
    item.quality === "Starter"
      ? "🌱"
      : item.qualityEmoji || getQualityEmoji(item.quality || "Common");

  return (
    `${item.emoji || "📦"} **${item.name || "Unknown Item"}**\n` +
    `└ ${qualityEmoji} ${item.quality || "Common"} • ${item.type || "Unknown"}\n` +
    `└ 🔓 Lv.${item.requiredLevel || 1}\n` +
    `└ 🎭 ${formatClass(item.compatibleClasses || ["all"])}\n` +
    `└ 📊 ${formatStats(item.stats || {})}\n` +
    `└ 🏷️ ID: \`${item.id || "no-id"}\`\n` +
    `└ 🧬 Base ID: \`${item.baseItemId || item.id || "no-base-id"}\``
  );
}

function shouldPersistRebalancedPlayer(oldPlayer = {}, newPlayer = {}) {
  const trackedKeys = [
    "level",
    "hp",
    "maxHp",
    "attack",
    "defense",
    "dodge",
    "crit",
  ];

  for (const key of trackedKeys) {
    if (Number(oldPlayer[key] || 0) !== Number(newPlayer[key] || 0)) {
      return true;
    }
  }

  if (
    JSON.stringify(oldPlayer.baseStats || {}) !==
    JSON.stringify(newPlayer.baseStats || {})
  ) {
    return true;
  }

  if (
    JSON.stringify(oldPlayer.equipment || {}) !==
    JSON.stringify(newPlayer.equipment || {})
  ) {
    return true;
  }

  if (
    JSON.stringify(oldPlayer.inventory || []) !==
    JSON.stringify(newPlayer.inventory || [])
  ) {
    return true;
  }

  return false;
}

async function persistRebalancedPlayer(playerRef, oldPlayer, rebalancedPlayer) {
  if (!shouldPersistRebalancedPlayer(oldPlayer, rebalancedPlayer)) {
    return false;
  }

  await playerRef.update({
    level: rebalancedPlayer.level,
    classId: rebalancedPlayer.classId,

    baseStats: rebalancedPlayer.baseStats,
    equipment: rebalancedPlayer.equipment,
    inventory: rebalancedPlayer.inventory,

    hp: rebalancedPlayer.hp,
    maxHp: rebalancedPlayer.maxHp,
    attack: rebalancedPlayer.attack,
    defense: rebalancedPlayer.defense,
    dodge: rebalancedPlayer.dodge,
    crit: rebalancedPlayer.crit,

    weapon:
      rebalancedPlayer.equipment?.weapon?.name ||
      getStarterWeaponByClass(rebalancedPlayer.classId).name,

    updatedAt: new Date(),
  });

  return true;
}

module.exports = async function characterCommand(message) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "You don’t have a character yet. Use `!s start` first."
    );
  }

  let player = playerDoc.data();

  const reviveResult = await resolvePlayerRevive(playerRef, player);
  player = reviveResult.player;

  const rebalancedPlayer = getRebalancedPlayer(player);

  await persistRebalancedPlayer(playerRef, player, rebalancedPlayer).catch(
    (error) => {
      console.error("Character rebalance save failed:", error);
    }
  );

  const hp = Number(rebalancedPlayer.hp || 0);
  const maxHp = Number(rebalancedPlayer.maxHp || 100);
  const attack = Number(rebalancedPlayer.attack || 10);
  const defense = Number(rebalancedPlayer.defense || 5);
  const dodge = Number(rebalancedPlayer.dodge || 0);
  const crit = Number(rebalancedPlayer.crit || 0);
  const gold = Number(rebalancedPlayer.gold || 0);
  const level = Number(rebalancedPlayer.level || 1);

  const equipment = rebalancedPlayer.equipment || getDefaultEquipment();
  const power = calculatePower(rebalancedPlayer);
  const overallScore = calculateOverallScore(rebalancedPlayer);
  const equippedCount = countEquippedItems(equipment);

  const status = hp <= 0 ? "Defeated 💀" : "Alive 🟢";

  let reviveText = "Available";

  if (hp <= 0) {
    const remainingSeconds = getReviveRemainingSeconds(rebalancedPlayer);

    reviveText =
      remainingSeconds > 0
        ? `Free revive in ${remainingSeconds}s`
        : "Free revive ready";
  }

  const revivedNotice = reviveResult.revived
    ? `✨ **Auto Revive Recovered:** ${reviveResult.revivedHp}/${maxHp} HP\n\n`
    : "";

  const embed = new EmbedBuilder()
    .setColor(hp <= 0 ? "#2B2B2B" : "#8B0000")
    .setTitle("🧙 SYXTH CHARACTER EQUIPMENT")
    .setDescription(
      `${revivedNotice}` +
        `👤 **${rebalancedPlayer.username || message.author.username}**\n` +
        `${rebalancedPlayer.classEmoji || "⚔️"} Class: **${
          rebalancedPlayer.class || "Novice"
        }**\n` +
        `⭐ Level: **${level}**\n` +
        `📊 Status: **${status}**\n` +
        `⚡ Power: **${power}**\n` +
        `🏆 Overall Score: **${overallScore}**\n` +
        `🪙 Gold: **${gold}**\n` +
        `🎒 Equipped: **${equippedCount}/6**\n` +
        `✨ Revive: **${reviveText}**\n\n` +
        `❤️ HP: **${hp}/${maxHp}**\n` +
        `⚔️ Attack: **${attack}**\n` +
        `🛡️ Defense: **${defense}**\n` +
        `💨 Dodge: **${dodge.toFixed(1)}%**\n` +
        `💥 Crit: **${crit.toFixed(1)}%**\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🗡️ **Weapon**\n${showEquipment(equipment.weapon, "Weapon")}\n\n` +
        `⛑️ **Helmet**\n${showEquipment(equipment.helmet, "Helmet")}\n\n` +
        `🦺 **Armor**\n${showEquipment(equipment.armor, "Armor")}\n\n` +
        `🧤 **Gloves**\n${showEquipment(equipment.gloves, "Gloves")}\n\n` +
        `👖 **Pants**\n${showEquipment(equipment.pants, "Pants")}\n\n` +
        `🥾 **Boots**\n${showEquipment(equipment.boots, "Boots")}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Equip: \`!s equip <item_id>\`\n` +
        `Unequip: \`!s unequip <slot>\`\n` +
        `Slots: \`weapon\`, \`helmet\`, \`armor\`, \`gloves\`, \`pants\`, \`boots\``
    )
    .setThumbnail(
      message.author.displayAvatarURL({
        dynamic: true,
      })
    )
    .setFooter({
      text: "Syxth MMORPG Character Equipment • Rebalanced Stats",
    });

  return message.reply({
    embeds: [embed],
  });
};