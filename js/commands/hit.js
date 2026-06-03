const { db } = require("../../firebase/firebase");
const { applyLevelUp, MAX_LEVEL } = require("../utils/levelSystem");
const { calculateTotalStats } = require("../utils/statSystem");
const { generateMonsterDrop } = require("../utils/lootSystem");
const { getQualityEmoji } = require("../utils/qualitySystem");
const balanceConfig = require("../data/balanceConfig");
const shopItems = require("../data/shopItems");

const {
  getActivePet,
  applyPetStats,
  addPetExpToActivePet,
  generateMonsterPetDrop,
  addPetToPets,
  formatDroppedPet,
  getPetMaxLevel,
  getPetRequiredExp,
  getPetExpDisplay,
} = require("../utils/petSystem");

function getNormalReviveSeconds() {
  return Number(balanceConfig.revive?.normalSeconds || 60);
}

function getInstantReviveCost() {
  return Number(balanceConfig.economy?.restCost || 100);
}

function getMonsterDropMinLevel() {
  return Number(balanceConfig.monsterDrop?.minLevel || 5);
}

function getNormalReviveHp(maxHp) {
  const revivePercent = Number(
    balanceConfig.revive?.freeReviveHpPercent || 50
  );

  return Math.max(
    1,
    Math.floor(Number(maxHp || 100) * (revivePercent / 100))
  );
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
  const attack = Math.floor(Number(stats.attack || 0) * multiplier);
  const defense = Math.floor(Number(stats.defense || 0) * multiplier);
  const maxHp = Math.floor(Number(stats.maxHp || 0) * multiplier);

  const dodge = capPercentStat(
    "dodge",
    Number((Number(stats.dodge || 0) * multiplier).toFixed(1)),
    quality,
    source
  );

  const crit = capPercentStat(
    "crit",
    Number((Number(stats.crit || 0) * multiplier).toFixed(1)),
    quality,
    source
  );

  return {
    attack,
    defense,
    maxHp,
    dodge,
    crit,
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
    return {
      ...item,
      quality,
      qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),
      quantity: Math.max(1, Number(item.quantity || 1)),
      stats: item.stats || getDefaultStats(),
      healPercent: Number(item.healPercent || 0),
      healAmount: Number(item.healAmount || item.heal || 0),
    };
  }

  const baseItem = findBaseShopItem(item);

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

function normalizeEquipment(equipment = {}) {
  const safeEquipment = {
    ...getDefaultEquipment(),
    ...equipment,
  };

  return {
    weapon: safeEquipment.weapon
      ? rebalanceItemStats(safeEquipment.weapon)
      : null,
    helmet: safeEquipment.helmet
      ? rebalanceItemStats(safeEquipment.helmet)
      : null,
    armor: safeEquipment.armor
      ? rebalanceItemStats(safeEquipment.armor)
      : null,
    gloves: safeEquipment.gloves
      ? rebalanceItemStats(safeEquipment.gloves)
      : null,
    pants: safeEquipment.pants
      ? rebalanceItemStats(safeEquipment.pants)
      : null,
    boots: safeEquipment.boots
      ? rebalanceItemStats(safeEquipment.boots)
      : null,
  };
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

function getNormalHitRandomBonus() {
  if (typeof balanceConfig.getCombatRandomBonus === "function") {
    return balanceConfig.getCombatRandomBonus("normalHitRandomBonus");
  }

  const bonusConfig = balanceConfig.combat?.normalHitRandomBonus || {
    min: 1,
    max: 8,
  };

  const min = Number(bonusConfig.min || 1);
  const max = Number(bonusConfig.max || min);

  if (max <= min) return min;

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateDamage(attackerAttack, defenderDefense, isCritical = false) {
  const baseDamage =
    Number(attackerAttack || 0) - Number(defenderDefense || 0);

  const randomBonus = getNormalHitRandomBonus();

  let damage = Math.max(1, baseDamage + randomBonus);

  if (isCritical) {
    damage *= 2;
  }

  return Math.max(1, Math.floor(damage));
}

function rollChance(percent) {
  return Math.random() * 100 < Number(percent || 0);
}

function addItemToInventory(inventory, droppedItem) {
  if (!droppedItem) return inventory;

  const existingItemIndex = inventory.findIndex(
    (item) =>
      item.baseItemId === droppedItem.baseItemId &&
      item.quality === droppedItem.quality &&
      JSON.stringify(item.stats || {}) ===
        JSON.stringify(droppedItem.stats || {})
  );

  if (existingItemIndex !== -1) {
    inventory[existingItemIndex].quantity =
      Number(inventory[existingItemIndex].quantity || 1) + 1;
  } else {
    inventory.push({
      ...droppedItem,
      quantity: 1,
    });
  }

  return inventory;
}

function formatDroppedItem(droppedItem) {
  if (!droppedItem) return "";

  const className = (droppedItem.compatibleClasses || ["all"])
    .map((cls) => {
      const text = String(cls || "all");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(", ");

  return (
    `\n🎁 **LOOT DROP!**\n` +
    `${droppedItem.emoji || "📦"} **${droppedItem.name}**\n` +
    `🏷️ ID: \`${droppedItem.id}\`\n` +
    `⭐ Quality: **${droppedItem.qualityEmoji} ${droppedItem.quality}**\n` +
    `🔓 Level: **Lv.${droppedItem.requiredLevel || 1}**\n` +
    `🎭 Class: **${className}**\n\n` +
    `⚔️ ATK: ${droppedItem.stats?.attack || 0}\n` +
    `🛡️ DEF: ${droppedItem.stats?.defense || 0}\n` +
    `❤️ HP: ${droppedItem.stats?.maxHp || 0}\n` +
    `💨 Dodge: ${droppedItem.stats?.dodge || 0}%\n` +
    `💥 Crit: ${droppedItem.stats?.crit || 0}%\n`
  );
}

function makeProgressBar(current, required, size = 10) {
  const safeCurrent = Math.max(0, Number(current || 0));
  const safeRequired = Math.max(1, Number(required || 1));

  const percent = Math.max(
    0,
    Math.min(1, safeCurrent / safeRequired)
  );

  const filled = Math.round(percent * size);
  const empty = Math.max(0, size - filled);

  return "▰".repeat(filled) + "▱".repeat(empty);
}

function formatPlayerExpReward(levelResult = {}, gainedExp = 0, totalStats = {}) {
  const expGain = Math.max(0, Number(gainedExp || 0));
  const level = Math.max(1, Number(levelResult.level || 1));
  const exp = Math.max(0, Number(levelResult.exp || 0));
  const nextLevelExp = Number(levelResult.nextLevelExp || 0);

  const isMaxLevel =
    level >= MAX_LEVEL ||
    !Number.isFinite(nextLevelExp) ||
    nextLevelExp <= 0;

  const expDisplay = isMaxLevel ? "MAX" : `${exp}/${nextLevelExp}`;
  const progressBar = isMaxLevel
    ? "▰▰▰▰▰▰▰▰▰▰"
    : makeProgressBar(exp, nextLevelExp);

  let text =
    `\n⭐ **PLAYER EXP GAINED**\n` +
    `🧙 You gained **+${expGain} EXP**\n` +
    `📈 Level: **Lv.${level}/${MAX_LEVEL}**\n` +
    `⭐ EXP: **${expDisplay}**\n` +
    `${progressBar}`;

  if (levelResult.leveledUp) {
    text +=
      `\n🔥 **LEVEL UP!** You are now **Level ${level}**.`;

    if (Number(levelResult.levelUps || 0) > 1) {
      text += ` (**+${levelResult.levelUps} levels**)`;
    }

    text +=
      `\n❤️ HP fully restored: **${totalStats.maxHp}/${totalStats.maxHp}**\n` +
      `⚔️ Attack: **${totalStats.attack}**\n` +
      `🛡️ Defense: **${totalStats.defense}**\n` +
      `💨 Dodge: **${Number(totalStats.dodge || 0).toFixed(1)}%**\n` +
      `💥 Crit: **${Number(totalStats.crit || 0).toFixed(1)}%**`;
  }

  if (isMaxLevel) {
    text += `\n👑 You reached max level **${MAX_LEVEL}**!`;
  }

  return text;
}

function getPetExpDisplaySafe(pet = {}) {
  if (typeof getPetExpDisplay === "function") {
    return getPetExpDisplay(pet);
  }

  const level = Math.max(1, Number(pet.level || 1));
  const maxLevel = getPetMaxLevel(pet);

  if (level >= maxLevel) {
    return "MAX";
  }

  const nextLevelExp =
    Number(pet.nextLevelExp || 0) || getPetRequiredExp(level);

  return `${Math.max(0, Number(pet.exp || 0))}/${nextLevelExp}`;
}

function formatPetExpReward(petExpResult) {
  if (!petExpResult?.activePet) {
    return "";
  }

  const gainedExp = Number(petExpResult.gainedExp || 0);

  if (gainedExp <= 0) {
    return "";
  }

  const pet = petExpResult.activePet;
  const level = Math.max(1, Number(pet.level || 1));
  const maxLevel = getPetMaxLevel(pet);
  const currentExp = Math.max(0, Number(pet.exp || 0));
  const nextLevelExp =
    Number(pet.nextLevelExp || 0) || getPetRequiredExp(level);

  const isMaxLevel = level >= maxLevel;

  const progressBar = isMaxLevel
    ? "▰▰▰▰▰▰▰▰▰▰"
    : makeProgressBar(currentExp, nextLevelExp);

  let text =
    `\n🐾 **PET EXP GAINED**\n` +
    `${pet.emoji || "🐾"} **${pet.name || "Unknown Pet"}** gained **+${gainedExp} EXP**\n` +
    `📈 Level: **Lv.${level}/${maxLevel}**\n` +
    `⭐ EXP: **${getPetExpDisplaySafe(pet)}**\n` +
    `${progressBar}`;

  if (petExpResult.leveledUp) {
    text +=
      `\n🔥 **PET LEVEL UP!** ` +
      `${pet.emoji || "🐾"} **${pet.name || "Unknown Pet"}** is now **Lv.${level}**.`;
  }

  return text;
}

module.exports = async function hitCommand(message) {
  const userId = message.author.id;

  const playerRef = db.collection("players").doc(userId);
  const battleRef = db.collection("battles").doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    const battleDoc = await transaction.get(battleRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "You don’t have a character yet. Use `!s start` first.",
      };
    }

    if (!battleDoc.exists) {
      return {
        ok: false,
        message: "You are not in battle. Use `!s hunt` first.",
      };
    }

    const player = playerDoc.data();
    const battle = battleDoc.data();

    const level = Math.max(1, Number(player.level || 1));
    const classId = player.classId || "swordsman";

    const baseStats = getBaseStatsByClassLevel(classId, level);
    const equipment = normalizeEquipment(player.equipment || {});
    const activePet = getActivePet(player);

    const equipmentStats = calculateTotalStats(baseStats, equipment);
    const currentStats = applyPetStats(equipmentStats, activePet);

    let playerHp = Math.min(
      Number(player.hp ?? currentStats.maxHp),
      Number(currentStats.maxHp || 100)
    );

    let monsterHp = Number(battle.monsterHp ?? battle.monsterMaxHp);

    if (playerHp <= 0) {
      transaction.update(playerRef, {
        hp: 0,
        baseStats,
        equipment,
        maxHp: currentStats.maxHp,
        attack: currentStats.attack,
        defense: currentStats.defense,
        dodge: currentStats.dodge,
        crit: currentStats.crit,
        updatedAt: new Date(),
      });

      transaction.delete(battleRef);

      return {
        ok: false,
        message:
          "💀 You are defeated. Use `!s rest` or wait for revival before attacking again.",
      };
    }

    const monsterDodgeChance = Number(battle.monsterDodge ?? 0);
    const monsterDodged = rollChance(monsterDodgeChance);

    const playerCritChance = Number(currentStats.crit ?? 0);
    const isCritical = !monsterDodged && rollChance(playerCritChance);

    let playerDamage = 0;

    if (!monsterDodged) {
      playerDamage = calculateDamage(
        currentStats.attack,
        battle.monsterDefense,
        isCritical
      );

      monsterHp -= playerDamage;
    }

    if (monsterHp <= 0) {
      const levelResult = applyLevelUp(
        {
          ...player,
          baseStats,
        },
        battle.monsterExp
      );

      const newGold =
        Number(player.gold ?? 0) + Number(battle.monsterGold || 0);

      const inventory = [...(player.inventory || [])];

      const droppedItem = generateMonsterDrop(
        Number(battle.monsterLevel || 1)
      );

      addItemToInventory(inventory, droppedItem);

      let pets = [...(player.pets || [])];

      const petExpGain = activePet
        ? Math.floor(
            Number(battle.monsterExp || 0) *
              (Number(balanceConfig.pet?.expGain?.monsterPercent || 20) / 100)
          )
        : 0;

      const petExpResult = addPetExpToActivePet(
        {
          ...player,
          pets,
          activePetId: player.activePetId || activePet?.id || null,
        },
        petExpGain
      );

      pets = petExpResult.pets;

      const droppedPet = generateMonsterPetDrop(
        Number(battle.monsterLevel || 1)
      );

      if (droppedPet) {
        pets = addPetToPets(pets, droppedPet);
      }

      const activePetAfterExp = getActivePet({
        ...player,
        pets,
        activePetId:
          petExpResult.activePet?.id ||
          activePet?.id ||
          player.activePetId ||
          null,
      });

      const equipmentStatsAfterLevel = calculateTotalStats(
        levelResult.baseStats,
        equipment
      );

      const totalStats = applyPetStats(
        equipmentStatsAfterLevel,
        activePetAfterExp
      );

      const finalHp = levelResult.leveledUp
        ? totalStats.maxHp
        : Math.min(playerHp, Number(totalStats.maxHp || 100));

      transaction.update(playerRef, {
        level: levelResult.level,
        exp: levelResult.exp,
        gold: newGold,

        inventory,
        equipment,

        pets,
        activePetId:
          activePetAfterExp?.id || player.activePetId || activePet?.id || null,

        baseStats: levelResult.baseStats,

        hp: finalHp,
        maxHp: totalStats.maxHp,

        attack: totalStats.attack,
        defense: totalStats.defense,
        dodge: totalStats.dodge,
        crit: totalStats.crit,

        monsterKills: Number(player.monsterKills || 0) + 1,

        reviveAvailableAt: null,
        raidReviveAvailableAt: null,

        updatedAt: new Date(),
      });

      transaction.delete(battleRef);

      return {
        ok: true,
        type: "monster_defeated",
        player,
        battle,
        playerDamage,
        monsterDodged,
        isCritical,
        levelResult,
        totalStats,
        droppedItem,
        droppedPet,
        petExpResult,
      };
    }

    const playerDodgeChance = Number(currentStats.dodge ?? 0);
    const dodged = rollChance(playerDodgeChance);

    const monsterCritChance = Number(battle.monsterCrit ?? 0);
    const monsterCritical = !dodged && rollChance(monsterCritChance);

    let monsterDamage = 0;

    if (!dodged) {
      monsterDamage = calculateDamage(
        battle.monsterAttack,
        currentStats.defense,
        monsterCritical
      );

      playerHp -= monsterDamage;
    }

    if (playerHp <= 0) {
      const reviveSeconds = getNormalReviveSeconds();
      const reviveAvailableAt = Date.now() + reviveSeconds * 1000;

      transaction.update(playerRef, {
        hp: 0,

        baseStats,
        equipment,

        maxHp: currentStats.maxHp,
        attack: currentStats.attack,
        defense: currentStats.defense,
        dodge: currentStats.dodge,
        crit: currentStats.crit,

        reviveAvailableAt,
        raidReviveAvailableAt: null,
        updatedAt: new Date(),
      });

      transaction.delete(battleRef);

      return {
        ok: true,
        type: "player_defeated",
        player,
        battle,
        playerDamage,
        monsterDamage,
        monsterDodged,
        isCritical,
        dodged,
        monsterCritical,
        reviveSeconds,
        reviveAvailableAt,
        instantReviveCost: getInstantReviveCost(),
        totalStats: currentStats,
      };
    }

    transaction.update(playerRef, {
      hp: playerHp,

      baseStats,
      equipment,

      maxHp: currentStats.maxHp,
      attack: currentStats.attack,
      defense: currentStats.defense,
      dodge: currentStats.dodge,
      crit: currentStats.crit,

      updatedAt: new Date(),
    });

    transaction.update(battleRef, {
      monsterHp,
      updatedAt: new Date(),
    });

    return {
      ok: true,
      type: "battle_continue",
      player,
      battle,
      playerHp,
      monsterHp,
      playerDamage,
      monsterDamage,
      monsterDodged,
      isCritical,
      dodged,
      monsterCritical,
      totalStats: currentStats,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Attack failed.");
  }

  if (result.type === "monster_defeated") {
    let reply = `🗡️ You defeated **${result.battle.monsterName}**!\n\n`;

    if (result.monsterDodged) {
      reply += `💨 **${result.battle.monsterName} dodged your attack!**\n`;
    }

    if (result.isCritical && !result.monsterDodged) {
      reply += `💥 **CRITICAL HIT!**\n`;
    }

    reply += `⚔️ Your Damage: **${result.playerDamage}**\n\n`;
    reply += `🪙 Gold: **+${result.battle.monsterGold}**\n`;

    reply += formatPlayerExpReward(
      result.levelResult,
      result.battle.monsterExp,
      result.totalStats
    );

    if (result.droppedItem) {
      reply += formatDroppedItem(result.droppedItem);
    } else if (
      Number(result.battle.monsterLevel || 1) >= getMonsterDropMinLevel()
    ) {
      reply += `\n🎁 **Loot Drop:** None\n`;
    }

    if (result.droppedPet) {
      reply += formatDroppedPet(result.droppedPet);
    }

    reply += formatPetExpReward(result.petExpResult);

    return message.reply(reply);
  }

  if (result.type === "player_defeated") {
    setTimeout(async () => {
      try {
        const latestDoc = await playerRef.get();

        if (!latestDoc.exists) return;

        const latestPlayer = latestDoc.data();
        const latestHp = Number(latestPlayer.hp ?? 0);
        const latestReviveAvailableAt = Number(
          latestPlayer.reviveAvailableAt ?? 0
        );

        if (
          latestHp <= 0 &&
          latestReviveAvailableAt === Number(result.reviveAvailableAt)
        ) {
          const revivedHp = getNormalReviveHp(latestPlayer.maxHp);

          await playerRef.update({
            hp: revivedHp,
            reviveAvailableAt: null,
            raidReviveAvailableAt: null,
            updatedAt: new Date(),
          });

          const user = await message.client.users
            .fetch(userId)
            .catch(() => null);

          if (user) {
            user
              .send(
                `╔════════════════════╗\n` +
                  `✨ 𝗥𝗘𝗩𝗜𝗩𝗔𝗟 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘 ✨\n` +
                  `╚════════════════════╝\n\n` +
                  `❤️ You have been automatically revived.\n` +
                  `🩹 Restored HP: ${revivedHp}/${latestPlayer.maxHp}\n\n` +
                  `⚔️ You may now continue your adventure in **Syxth MMORPG**.`
              )
              .catch(() => null);
          }

          console.log(
            `${latestPlayer.username || userId} has been automatically revived.`
          );
        }
      } catch (error) {
        console.error("Auto revive error:", error);
      }
    }, result.reviveSeconds * 1000).unref?.();

    return message.reply(
      `╔════════════════════╗\n` +
        `💀 𝗬𝗢𝗨 𝗛𝗔𝗩𝗘 𝗕𝗘𝗘𝗡 𝗗𝗘𝗙𝗘𝗔𝗧𝗘𝗗 💀\n` +
        `╚════════════════════╝\n\n` +
        `👹 Enemy: **${result.battle.monsterName}**\n` +
        `${result.monsterDodged ? `💨 Enemy Dodge: **YES**\n` : ""}` +
        `${result.isCritical ? `💥 Critical Hit: **YES**\n` : ""}` +
        `⚔️ Your Damage: **${result.playerDamage}**\n` +
        `${result.monsterCritical ? `🔥 Monster Critical: **YES**\n` : ""}` +
        `🔥 Enemy Damage: **${result.monsterDamage}**\n\n` +
        `⏳ Revival Cooldown: **${result.reviveSeconds} seconds**\n` +
        `💰 Instant Revive Cost: **${result.instantReviveCost} Gold**\n\n` +
        `🛌 Use \`!s rest\` to instantly revive.\n` +
        `⌛ Or wait for automatic revival.`
    );
  }

  return message.reply(
    `${result.monsterDodged ? `💨 **${result.battle.monsterName} dodged your attack!**\n` : ""}` +
      `${!result.monsterDodged && result.isCritical ? `💥 **CRITICAL HIT!**\n` : ""}` +
      `⚔️ You hit **${result.battle.monsterName}** for **${result.playerDamage}** damage!\n` +
      `🩸 Monster HP: ${result.monsterHp}/${result.battle.monsterMaxHp}\n\n` +
      `${
        result.dodged
          ? `💨 **DODGE!** You avoided **${result.battle.monsterName}'s** attack!\n`
          : `${result.monsterCritical ? `🔥 **MONSTER CRITICAL HIT!**\n` : ""}` +
            `🔥 ${result.battle.monsterName} hit you for **${result.monsterDamage}** damage!\n`
      }` +
      `❤️ Your HP: ${result.playerHp}/${Number(result.totalStats.maxHp || 100)}\n\n` +
      `Use \`!s hit\` to attack again or \`!s retreat\` to escape.`
  );
};