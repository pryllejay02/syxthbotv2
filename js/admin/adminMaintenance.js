const { db } = require("../../firebase/firebase");

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

function getDefaultBaseStats(player) {
  return {
    attack: Number(player.attack || 10),
    defense: Number(player.defense || 5),
    maxHp: Number(player.maxHp || 100),
    dodge: Number(player.dodge || 0),
    crit: Number(player.crit || 0),
  };
}

function normalizeStarterWeapon(player) {
  const classId = player.classId || "swordsman";
  const starterWeapon = getStarterWeaponByClass(classId);

  const currentWeapon = player.equipment?.weapon;

  if (currentWeapon) {
    return {
      ...currentWeapon,
      baseItemId: currentWeapon.baseItemId || currentWeapon.id,
      qualityEmoji:
        currentWeapon.qualityEmoji ||
        (currentWeapon.quality === "Starter" ? "🌱" : ""),
      source: currentWeapon.source || "starter",
      isStarter:
        currentWeapon.isStarter === true ||
        currentWeapon.quality === "Starter",
      compatibleClasses:
        currentWeapon.compatibleClasses || [classId],
      quantity: Number(currentWeapon.quantity || 1),
      stats: {
        attack: Number(currentWeapon.stats?.attack || 0),
        defense: Number(currentWeapon.stats?.defense || 0),
        maxHp: Number(currentWeapon.stats?.maxHp || 0),
        dodge: Number(currentWeapon.stats?.dodge || 0),
        crit: Number(currentWeapon.stats?.crit || 0),
      },
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
      requiredLevel: Number(item.requiredLevel || 1),
      compatibleClasses: item.compatibleClasses || ["all"],
      quantity: Math.max(1, Number(item.quantity || 1)),
      price: Number(item.price || 0),
      stats: {
        attack: Number(item.stats?.attack || 0),
        defense: Number(item.stats?.defense || 0),
        maxHp: Number(item.stats?.maxHp || 0),
        dodge: Number(item.stats?.dodge || 0),
        crit: Number(item.stats?.crit || 0),
      },
    }));
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

    const baseStats = player.baseStats || getDefaultBaseStats(player);
    const maxHp = Number(player.maxHp || baseStats.maxHp || 100);
    const hp = Math.max(0, Math.min(Number(player.hp ?? maxHp), maxHp));

    const repairedData = {
      userId: player.userId || target.id,
      username: player.username || target.username,

      level: Number(player.level || 1),
      exp: Number(player.exp || 0),
      gold: Number(player.gold || 0),

      hp,
      maxHp,

      attack: Number(player.attack || baseStats.attack || 10),
      defense: Number(player.defense || baseStats.defense || 5),
      dodge: Number(player.dodge || baseStats.dodge || 0),
      crit: Number(player.crit || baseStats.crit || 0),

      class: player.class || "Novice",
      classId: player.classId || "swordsman",
      classEmoji: player.classEmoji || "⚔️",

      weapon: player.weapon || getStarterWeaponByClass(player.classId).name,

      inventory: normalizeInventory(player.inventory || []),
      equipment: normalizeEquipment(player),

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
      `🎒 Inventory: **${result.repairedData.inventory.length} stack(s)**\n` +
      `🏠 Room: ${
        result.repairedData.privateChannelId
          ? `<#${result.repairedData.privateChannelId}>`
          : "No private room linked"
      }`
  );
};