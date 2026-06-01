const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const balanceConfig = require("../data/balanceConfig");

function getMention(message) {
  return message.mentions.users.first();
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

function normalizeStarterWeapon(player) {
  const classId = player.classId || "swordsman";
  const starterWeapon = getStarterWeaponByClass(classId);

  const currentWeapon = player.equipment?.weapon;

  if (currentWeapon) {
    return {
      ...currentWeapon,

      id: currentWeapon.id || `${classId}_starter_weapon`,
      baseItemId:
        currentWeapon.baseItemId ||
        currentWeapon.id ||
        `${classId}_starter_weapon`,

      name: currentWeapon.name || starterWeapon.name,
      type: currentWeapon.type || "Weapon",

      quality: currentWeapon.quality || "Starter",
      qualityEmoji:
        currentWeapon.qualityEmoji ||
        (currentWeapon.quality === "Starter" ? "🌱" : ""),

      requiredLevel: Number(currentWeapon.requiredLevel || 1),
      compatibleClasses: currentWeapon.compatibleClasses || [classId],

      price: Number(currentWeapon.price || 0),
      description: currentWeapon.description || "Starter weapon.",
      source: currentWeapon.source || "starter",

      isStarter:
        currentWeapon.isStarter === true ||
        currentWeapon.quality === "Starter",

      quantity: Number(currentWeapon.quantity || 1),

      stats: {
        attack: Number(currentWeapon.stats?.attack || 0),
        defense: Number(currentWeapon.stats?.defense || 0),
        maxHp: Number(currentWeapon.stats?.maxHp || 0),
        dodge: Number(currentWeapon.stats?.dodge || 0),
        crit: Number(currentWeapon.stats?.crit || 0),
      },

      emoji: currentWeapon.emoji || starterWeapon.emoji,
    };
  }

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

    stats: {
      attack: 0,
      defense: 0,
      maxHp: 0,
      dodge: 0,
      crit: 0,
    },

    emoji: starterWeapon.emoji,
  };
}

function normalizeEquipment(player) {
  const equipment = player.equipment || {};

  return {
    weapon: normalizeStarterWeapon(player),
    helmet: equipment.helmet || null,
    armor: equipment.armor || null,
    gloves: equipment.gloves || null,
    pants: equipment.pants || null,
    boots: equipment.boots || null,
  };
}

function normalizeInventory(inventory = []) {
  if (!Array.isArray(inventory)) return [];

  return inventory
    .filter(Boolean)
    .map((item) => ({
      ...item,

      id: item.id || item.baseItemId || `unknown_${Date.now()}`,
      baseItemId: item.baseItemId || item.id || null,

      name: item.name || "Unknown Item",
      type: item.type || "Unknown",

      quality: item.quality || "Common",
      qualityEmoji: item.qualityEmoji || "",

      requiredLevel: Number(item.requiredLevel || 1),
      compatibleClasses: item.compatibleClasses || ["all"],

      quantity: Math.max(1, Number(item.quantity || 1)),
      price: Number(item.price || 0),

      description: item.description || "",
      source: item.source || "unknown",
      emoji: item.emoji || "📦",

      stats: {
        attack: Number(item.stats?.attack || 0),
        defense: Number(item.stats?.defense || 0),
        maxHp: Number(item.stats?.maxHp || 0),
        dodge: Number(item.stats?.dodge || 0),
        crit: Number(item.stats?.crit || 0),
      },
    }));
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

    const baseStats = balanceConfig.getBaseStatsByClassLevel(
      classId,
      level
    );

    const equipment = normalizeEquipment({
      ...player,
      classId,
    });

    const totalStats = calculateTotalStats(baseStats, equipment);

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

      weapon: player.weapon || getStarterWeaponByClass(classId).name,

      inventory: normalizeInventory(player.inventory || []),
      equipment,

      baseStats,

      monsterKills: Number(player.monsterKills || 0),
      retreats: Number(player.retreats || 0),

      reviveAvailableAt: player.reviveAvailableAt || null,
      raidReviveAvailableAt: player.raidReviveAvailableAt || null,

      updatedAt: new Date(),
    };

    if (player.createdAt) {
      repairedData.createdAt = player.createdAt;
    } else {
      repairedData.createdAt = new Date();
    }

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
      repairedData,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Player repair failed.");
  }

  return message.reply(
    `✅ Player data repaired for **${target.username}**.\n\n` +
      `👤 Username: **${result.repairedData.username}**\n` +
      `🎭 Class: **${result.repairedData.class}**\n` +
      `⭐ Level: **${result.repairedData.level}**\n` +
      `❤️ HP: **${result.repairedData.hp}/${result.repairedData.maxHp}**\n` +
      `⚔️ ATK: **${result.repairedData.attack}**\n` +
      `🛡️ DEF: **${result.repairedData.defense}**\n` +
      `💨 Dodge: **${result.repairedData.dodge}%**\n` +
      `💥 Crit: **${result.repairedData.crit}%**\n` +
      `🎒 Inventory: **${result.repairedData.inventory.length} stack(s)**\n` +
      `🏠 Room: ${
        result.repairedData.privateChannelId
          ? `<#${result.repairedData.privateChannelId}>`
          : "No private room linked"
      }`
  );
};