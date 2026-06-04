const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");
const { getQualityEmoji } = require("../utils/qualitySystem");

const {
  getActivePet,
  applyPetStats,
  normalizePets,
  getPetDisplayEmoji,
} = require("../utils/petSystem");

const EQUIPMENT_SLOTS = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "pants",
  "boots",
];

function getMention(message) {
  return message.mentions.users.first();
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
      quantity: Math.max(1, Number(item.quantity || 1)),
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

      price: Math.max(
        0,
        Math.floor(Number(sourceItem.price || item.price || 0))
      ),

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
      quantity: Math.max(1, Number(item.quantity || 1)),
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

    quantity: Math.max(1, Number(item.quantity || 1)),
    source,
  };
}

function normalizeInventory(inventory = []) {
  if (!Array.isArray(inventory)) return [];

  return inventory
    .filter(Boolean)
    .map((item) => rebalanceItemStats(item))
    .filter(Boolean);
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

function getHpAfterRebalance(player, oldMaxHp, newMaxHp) {
  const oldHp = Number(player.hp ?? oldMaxHp ?? newMaxHp);

  if (oldHp <= 0) return 0;

  const safeOldMaxHp = Math.max(1, Number(oldMaxHp || newMaxHp || 100));
  const hpPercent = oldHp / safeOldMaxHp;

  return Math.max(
    1,
    Math.min(newMaxHp, Math.floor(Number(newMaxHp || 100) * hpPercent))
  );
}

module.exports = async function adminMaintenance(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const target = getMention(message);

  if (subCommand !== "repairplayer") {
    return message.reply("❌ Unknown maintenance admin command.");
  }

  if (!target || target.bot) {
    return message.reply("❌ Usage: `!s admin repairplayer @player`");
  }

  const playerRef = db.collection("players").doc(target.id);

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "❌ Character not found.",
      };
    }

    const player = playerDoc.data();

    const classId = player.classId || "swordsman";
    const level = Math.max(1, Number(player.level || 1));

    const oldStats = {
      hp: Number(player.hp || 0),
      maxHp: Number(player.maxHp || 0),
      attack: Number(player.attack || 0),
      defense: Number(player.defense || 0),
      dodge: Number(player.dodge || 0),
      crit: Number(player.crit || 0),
    };

    const baseStats = getBaseStatsByClassLevel(classId, level);

    const equipment = normalizeEquipment({
      ...player,
      classId,
    });

    const inventory = normalizeInventory(player.inventory || []);
    const pets = normalizePets(player.pets || []);

    const activePet = getActivePet({
      ...player,
      pets,
      activePetId: player.activePetId || null,
    });

    const activePetId = activePet?.id || player.activePetId || null;

    const equipmentStats = calculateTotalStats(baseStats, equipment);
    const totalStats = applyPetStats(equipmentStats, activePet);

    const oldMaxHp = Number(player.maxHp || baseStats.maxHp || 100);
    const hp = getHpAfterRebalance(player, oldMaxHp, totalStats.maxHp);

    const repairedData = {
      userId: player.userId || target.id,
      username: player.username || target.username,

      level,
      exp: Math.max(0, Number(player.exp || 0)),
      gold: Math.max(0, Number(player.gold || 0)),

      hp,
      maxHp: totalStats.maxHp,

      attack: totalStats.attack,
      defense: totalStats.defense,
      dodge: totalStats.dodge,
      crit: totalStats.crit,

      class: player.class || "Swordsman",
      classId,
      classEmoji: player.classEmoji || "⚔️",

      weapon: equipment.weapon?.name || getStarterWeaponByClass(classId).name,

      inventory,
      equipment,
      baseStats,

      pets,
      activePetId,

      monsterKills: Number(player.monsterKills || 0),
      retreats: Number(player.retreats || 0),

      reviveAvailableAt: player.reviveAvailableAt || null,
      raidReviveAvailableAt: player.raidReviveAvailableAt || null,

      createdAt: player.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (player.world) {
      repairedData.world = player.world;
    }

    if (player.privateChannelId) {
      repairedData.privateChannelId = player.privateChannelId;
    }

    transaction.set(playerRef, repairedData, {
      merge: true,
    });

    return {
      ok: true,
      oldStats,
      repairedData,
      activePet,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Player repair failed.");
  }

  const activePetText = result.activePet
    ? `${getPetDisplayEmoji(result.activePet)} ${result.activePet.name} Lv.${
        result.activePet.level || 1
      }`
    : "None";

  return message.reply(
    `✅ Player data repaired and rebalanced for **${target.username}**.\n\n` +
      `📉 **Old Stats**\n` +
      `❤️ HP: **${result.oldStats.hp}/${result.oldStats.maxHp}**\n` +
      `⚔️ ATK: **${result.oldStats.attack}**\n` +
      `🛡️ DEF: **${result.oldStats.defense}**\n` +
      `💨 Dodge: **${result.oldStats.dodge}%**\n` +
      `💥 Crit: **${result.oldStats.crit}%**\n\n` +
      `📊 **New Rebalanced Stats**\n` +
      `👤 Username: **${result.repairedData.username}**\n` +
      `🎭 Class: **${result.repairedData.class}**\n` +
      `⭐ Level: **${result.repairedData.level}**\n` +
      `❤️ HP: **${result.repairedData.hp}/${result.repairedData.maxHp}**\n` +
      `⚔️ ATK: **${result.repairedData.attack}**\n` +
      `🛡️ DEF: **${result.repairedData.defense}**\n` +
      `💨 Dodge: **${result.repairedData.dodge}%**\n` +
      `💥 Crit: **${result.repairedData.crit}%**\n` +
      `🐾 Pets Owned: **${result.repairedData.pets.length}**\n` +
      `🐾 Active Pet: **${activePetText}**\n` +
      `🎒 Inventory: **${result.repairedData.inventory.length} stack(s)**\n` +
      `🏠 Room: ${
        result.repairedData.privateChannelId
          ? `<#${result.repairedData.privateChannelId}>`
          : "No private room linked"
      }`
  );
};