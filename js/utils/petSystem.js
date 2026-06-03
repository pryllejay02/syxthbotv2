const petsData = require("../data/pets");
const balanceConfig = require("../data/balanceConfig");
const { getQualityEmoji } = require("./qualitySystem");

const DEFAULT_PETS_PER_PAGE = 5;
const VALID_PET_QUALITIES = ["Common", "Rare", "Legendary"];

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeQuality(quality = "Common") {
  const normalized = String(quality || "Common");

  return VALID_PET_QUALITIES.includes(normalized) ? normalized : "Common";
}

function rollChance(percent = 0) {
  return Math.random() * 100 < Number(percent || 0);
}

function randomBetween(min, max) {
  if (typeof balanceConfig.randomBetween === "function") {
    return balanceConfig.randomBetween(min, max);
  }

  const safeMin = Number(min || 0);
  const safeMax = Number(max || safeMin);

  if (safeMax <= safeMin) return safeMin;

  return Math.random() * (safeMax - safeMin) + safeMin;
}

function getPetConfigBySource(quality = "Common", source = "monster_pet_drop") {
  const normalizedQuality = normalizeQuality(quality);

  if (source === "boss_pet_drop") {
    return {
      statRolls: balanceConfig.pet?.bossDrop?.statRolls?.[normalizedQuality],
      statCaps: balanceConfig.pet?.bossDrop?.statCaps?.[normalizedQuality],
      priceMultiplier: Number(
        balanceConfig.pet?.bossDrop?.priceMultiplier?.[normalizedQuality] || 1
      ),
    };
  }

  return {
    statRolls: balanceConfig.pet?.monsterDrop?.statRolls?.[normalizedQuality],
    statCaps: balanceConfig.pet?.monsterDrop?.statCaps?.[normalizedQuality],
    priceMultiplier: Number(
      balanceConfig.pet?.monsterDrop?.priceMultiplier?.[normalizedQuality] || 1
    ),
  };
}

function capPetStat(
  statName,
  value,
  quality = "Common",
  source = "monster_pet_drop"
) {
  const statValue = Number(value || 0);
  const config = getPetConfigBySource(quality, source);
  const cap = Number(config.statCaps?.[statName] || 0);

  if (!cap) return statValue;

  return Math.min(statValue, cap);
}

function rollPetStats(
  baseStats = {},
  quality = "Common",
  source = "monster_pet_drop"
) {
  const normalizedQuality = normalizeQuality(quality);
  const config = getPetConfigBySource(normalizedQuality, source);
  const rollConfig = config.statRolls || { min: 1, max: 1 };

  const multiplier = randomBetween(
    Number(rollConfig.min || 1),
    Number(rollConfig.max || rollConfig.min || 1)
  );

  return {
    attack: capPetStat(
      "attack",
      Math.floor(Number(baseStats.attack || 0) * multiplier),
      normalizedQuality,
      source
    ),

    defense: capPetStat(
      "defense",
      Math.floor(Number(baseStats.defense || 0) * multiplier),
      normalizedQuality,
      source
    ),

    maxHp: capPetStat(
      "maxHp",
      Math.floor(Number(baseStats.maxHp || 0) * multiplier),
      normalizedQuality,
      source
    ),

    dodge: capPetStat(
      "dodge",
      Number((Number(baseStats.dodge || 0) * multiplier).toFixed(2)),
      normalizedQuality,
      source
    ),

    crit: capPetStat(
      "crit",
      Number((Number(baseStats.crit || 0) * multiplier).toFixed(2)),
      normalizedQuality,
      source
    ),
  };
}

function getPetPrice(
  basePet = {},
  quality = "Common",
  source = "monster_pet_drop"
) {
  const config = getPetConfigBySource(quality, source);

  return Math.max(
    0,
    Math.floor(
      Number(basePet.basePrice || 0) * Number(config.priceMultiplier || 1)
    )
  );
}

function createPet(basePet, quality = "Common", source = "monster_pet_drop") {
  if (!basePet) return null;

  const normalizedQuality = normalizeQuality(quality);
  const qualityEmoji = getQualityEmoji(normalizedQuality);

  return {
    id: `${basePet.id}_${normalizedQuality.toLowerCase()}_pet_${Date.now()}_${Math.floor(
      Math.random() * 99999
    )}`,

    basePetId: basePet.id,
    name: basePet.name,
    emoji: basePet.emoji || "🐾",
    type: basePet.type || "balanced",

    quality: normalizedQuality,
    qualityEmoji,

    level: 1,
    exp: 0,

    requiredLevel: Number(basePet.requiredLevel || 1),
    source,

    locked: false,
    active: false,

    stats: rollPetStats(basePet.baseStats || {}, normalizedQuality, source),
    price: getPetPrice(basePet, normalizedQuality, source),

    createdAt: new Date(),
  };
}

function getPossiblePets(dropGroup, quality, level) {
  const normalizedQuality = normalizeQuality(quality);
  const sourceLevel = Number(level || 1);

  return petsData.filter((pet) => {
    if (!pet) return false;
    if (String(pet.dropGroup || "") !== String(dropGroup || "")) return false;

    const allowedQualities = Array.isArray(pet.allowedQualities)
      ? pet.allowedQualities
      : ["Common"];

    if (!allowedQualities.includes(normalizedQuality)) return false;

    return Number(pet.requiredLevel || 1) <= sourceLevel;
  });
}

function pickRandomPet(pets = []) {
  if (!pets.length) return null;

  return pets[Math.floor(Math.random() * pets.length)];
}

function generateMonsterPetDrop(monsterLevel) {
  const level = Number(monsterLevel || 1);
  const minLevel = Number(balanceConfig.pet?.monsterDrop?.minLevel || 5);

  if (level < minLevel) return null;

  const chance = Number(balanceConfig.pet?.monsterDrop?.commonChance || 0);

  if (!rollChance(chance)) return null;

  const possiblePets = getPossiblePets("monster", "Common", level);
  const basePet = pickRandomPet(possiblePets);

  if (!basePet) return null;

  return createPet(basePet, "Common", "monster_pet_drop");
}

function generateBossPetDrop(bossLevel) {
  const level = Number(bossLevel || 1);

  const legendaryChance = Number(
    balanceConfig.pet?.bossDrop?.legendaryChance || 0
  );

  const rareChance = Number(balanceConfig.pet?.bossDrop?.rareChance || 0);

  if (rollChance(legendaryChance)) {
    const possibleLegendaryPets = getPossiblePets("boss", "Legendary", level);
    const basePet = pickRandomPet(possibleLegendaryPets);

    if (basePet) {
      return createPet(basePet, "Legendary", "boss_pet_drop");
    }
  }

  if (rollChance(rareChance)) {
    const possibleRarePets = getPossiblePets("boss", "Rare", level);
    const basePet = pickRandomPet(possibleRarePets);

    if (basePet) {
      return createPet(basePet, "Rare", "boss_pet_drop");
    }
  }

  return null;
}

function normalizePet(pet = {}) {
  if (!pet) return null;

  const quality = normalizeQuality(pet.quality || "Common");

  return {
    ...pet,

    basePetId: pet.basePetId || pet.id,
    name: pet.name || "Unknown Pet",
    emoji: pet.emoji || "🐾",
    type: pet.type || "balanced",

    quality,
    qualityEmoji: pet.qualityEmoji || getQualityEmoji(quality),

    level: Math.max(1, Number(pet.level || 1)),
    exp: Math.max(0, Number(pet.exp || 0)),

    requiredLevel: Number(pet.requiredLevel || 1),

    locked: pet.locked === true,
    active: pet.active === true,

    stats: {
      attack: Number(pet.stats?.attack || 0),
      defense: Number(pet.stats?.defense || 0),
      maxHp: Number(pet.stats?.maxHp || 0),
      dodge: Number(pet.stats?.dodge || 0),
      crit: Number(pet.stats?.crit || 0),
    },

    price: Math.max(0, Math.floor(Number(pet.price || 0))),
    source: pet.source || "unknown",
  };
}

function cleanPetForStorage(pet = {}) {
  const {
    leveledUp,
    levelUps,
    maxLevel,
    nextLevelExp,
    ...cleanPet
  } = pet || {};

  return cleanPet;
}

function normalizePets(pets = []) {
  return getArray(pets).map((pet) => normalizePet(pet)).filter(Boolean);
}

function addPetToPets(pets = [], pet) {
  const normalizedPets = normalizePets(pets);
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) return normalizedPets;

  normalizedPets.push({
    ...cleanPetForStorage(normalizedPet),
    active: false,
    locked: normalizedPet.locked === true,
  });

  return normalizedPets;
}

function addPetToPlayer(player = {}, pet) {
  return {
    ...player,
    pets: addPetToPets(player.pets || [], pet),
  };
}

function findPlayerPet(player = {}, petId) {
  const targetId = normalizeId(petId);
  const pets = normalizePets(player.pets || []);

  return pets.find((pet) => {
    return (
      normalizeId(pet.id) === targetId ||
      normalizeId(pet.basePetId) === targetId
    );
  });
}

function findPetIndex(pets = [], petId) {
  const targetId = normalizeId(petId);

  return normalizePets(pets).findIndex((pet) => {
    return (
      normalizeId(pet.id) === targetId ||
      normalizeId(pet.basePetId) === targetId
    );
  });
}

function getActivePet(player = {}) {
  const pets = normalizePets(player.pets || []);
  const activePetId = normalizeId(player.activePetId);

  if (activePetId) {
    const activeById = pets.find((pet) => normalizeId(pet.id) === activePetId);

    if (activeById) return activeById;
  }

  return pets.find((pet) => pet.active === true) || null;
}

function equipPet(player = {}, petId) {
  const pets = normalizePets(player.pets || []);
  const targetIndex = findPetIndex(pets, petId);

  if (targetIndex === -1) {
    return {
      ok: false,
      message: "❌ You don’t have that pet.",
    };
  }

  const targetPet = pets[targetIndex];

  const updatedPets = pets.map((pet, index) => ({
    ...pet,
    active: index === targetIndex,
  }));

  return {
    ok: true,
    pet: targetPet,
    pets: updatedPets,
    activePetId: targetPet.id,
  };
}

function unequipPet(player = {}) {
  const activePet = getActivePet(player);

  const pets = normalizePets(player.pets || []).map((pet) => ({
    ...pet,
    active: false,
  }));

  return {
    ok: true,
    pet: activePet,
    pets,
    activePetId: null,
  };
}

function isPetLocked(pet = {}) {
  return pet?.locked === true;
}

function lockPet(player = {}, petId) {
  const pets = normalizePets(player.pets || []);
  const index = findPetIndex(pets, petId);

  if (index === -1) {
    return {
      ok: false,
      message: "❌ You don’t have that pet.",
    };
  }

  pets[index] = {
    ...pets[index],
    locked: true,
  };

  return {
    ok: true,
    pet: pets[index],
    pets,
  };
}

function unlockPet(player = {}, petId) {
  const pets = normalizePets(player.pets || []);
  const index = findPetIndex(pets, petId);

  if (index === -1) {
    return {
      ok: false,
      message: "❌ You don’t have that pet.",
    };
  }

  pets[index] = {
    ...pets[index],
    locked: false,
  };

  return {
    ok: true,
    pet: pets[index],
    pets,
  };
}

function getPetMaxLevel(pet = {}) {
  const quality = normalizeQuality(pet.quality || "Common");

  return Number(
    balanceConfig.pet?.maxLevelByQuality?.[quality] ||
      balanceConfig.pet?.maxLevelByQuality?.Common ||
      20
  );
}

function getPetRequiredExp(level) {
  const lv = Math.max(1, Number(level || 1));

  return Math.floor(60 + lv * 35 + lv * lv * 8);
}

function getPetExpDisplay(pet = {}) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) return "0/0";

  const maxLevel = getPetMaxLevel(normalizedPet);

  if (Number(normalizedPet.level || 1) >= maxLevel) {
    return `${Number(normalizedPet.exp || 0)}/MAX`;
  }

  return `${Number(normalizedPet.exp || 0)}/${getPetRequiredExp(
    normalizedPet.level
  )}`;
}

function applyPetLevelUp(pet = {}, gainedExp = 0) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) return null;

  const maxLevel = getPetMaxLevel(normalizedPet);

  let level = Math.max(1, Number(normalizedPet.level || 1));
  let exp = Math.max(0, Number(normalizedPet.exp || 0) + Number(gainedExp || 0));

  let leveledUp = false;
  let levelUps = 0;

  while (level < maxLevel && exp >= getPetRequiredExp(level)) {
    exp -= getPetRequiredExp(level);
    level++;
    levelUps++;
    leveledUp = true;
  }

  if (level >= maxLevel) {
    level = maxLevel;
    exp = 0;
  }

  return {
    ...normalizedPet,
    level,
    exp,
    leveledUp,
    levelUps,
    maxLevel,
    nextLevelExp: level >= maxLevel ? "MAX" : getPetRequiredExp(level),
  };
}

function addPetExpToActivePet(player = {}, gainedExp = 0) {
  const activePet = getActivePet(player);

  if (!activePet || Number(gainedExp || 0) <= 0) {
    return {
      pets: normalizePets(player.pets || []),
      activePet: null,
      gainedExp: 0,
      leveledUp: false,
      levelUps: 0,
    };
  }

  const pets = normalizePets(player.pets || []);
  const activeIndex = pets.findIndex((pet) => pet.id === activePet.id);

  if (activeIndex === -1) {
    return {
      pets,
      activePet: null,
      gainedExp: 0,
      leveledUp: false,
      levelUps: 0,
    };
  }

  const updatedPet = applyPetLevelUp(pets[activeIndex], gainedExp);

  pets[activeIndex] = {
    ...cleanPetForStorage(updatedPet),
    active: true,
  };

  return {
    pets,
    activePet: pets[activeIndex],
    gainedExp: Number(gainedExp || 0),
    leveledUp: updatedPet.leveledUp,
    levelUps: updatedPet.levelUps,
  };
}

function calculatePetStats(pet = {}) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) {
    return {
      attack: 0,
      defense: 0,
      maxHp: 0,
      dodge: 0,
      crit: 0,
    };
  }

  const petLevel = Math.min(
    Number(normalizedPet.level || 1),
    getPetMaxLevel(normalizedPet)
  );

  const stats = normalizedPet.stats || {};
  const scaling = balanceConfig.pet?.levelScaling || {};

  return {
    attack: Math.floor(
      Number(stats.attack || 0) +
        petLevel * Number(scaling.attackPerLevel || 0.25)
    ),

    defense: Math.floor(
      Number(stats.defense || 0) +
        petLevel * Number(scaling.defensePerLevel || 0.2)
    ),

    maxHp: Math.floor(
      Number(stats.maxHp || 0) +
        petLevel * Number(scaling.maxHpPerLevel || 2)
    ),

    dodge: Number(
      (
        Number(stats.dodge || 0) +
        petLevel * Number(scaling.dodgePerLevel || 0.01)
      ).toFixed(2)
    ),

    crit: Number(
      (
        Number(stats.crit || 0) +
        petLevel * Number(scaling.critPerLevel || 0.015)
      ).toFixed(2)
    ),
  };
}

function applyPetStats(totalStats = {}, activePet = null) {
  if (!activePet) return totalStats;

  const petStats = calculatePetStats(activePet);

  const dodgeCap = Number(balanceConfig.statCaps?.dodge || 50);
  const critCap = Number(balanceConfig.statCaps?.crit || 65);

  return {
    attack: Math.floor(Number(totalStats.attack || 0) + petStats.attack),
    defense: Math.floor(Number(totalStats.defense || 0) + petStats.defense),
    maxHp: Math.floor(Number(totalStats.maxHp || 0) + petStats.maxHp),

    dodge: Number(
      Math.min(dodgeCap, Number(totalStats.dodge || 0) + petStats.dodge).toFixed(
        2
      )
    ),

    crit: Number(
      Math.min(critCap, Number(totalStats.crit || 0) + petStats.crit).toFixed(2)
    ),
  };
}

function getPetSellPrice(pet = {}) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) return 0;

  const multiplier = Number(
    balanceConfig.pet?.sellMultiplier?.[normalizedPet.quality] ||
      balanceConfig.pet?.sellMultiplier?.Common ||
      0.45
  );

  return Math.max(
    0,
    Math.floor(
      Number(normalizedPet.price || 0) *
        multiplier *
        (1 + Number(normalizedPet.level || 1) * 0.03)
    )
  );
}

function canSellPet(pet = {}, activePetId = null) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) {
    return {
      ok: false,
      message: "❌ Pet not found.",
    };
  }

  if (normalizeId(normalizedPet.id) === normalizeId(activePetId)) {
    return {
      ok: false,
      message: "❌ You cannot sell your active pet. Unequip it first.",
    };
  }

  if (isPetLocked(normalizedPet)) {
    return {
      ok: false,
      message: "🔒 This pet is locked. Unlock it first before selling.",
    };
  }

  if (getPetSellPrice(normalizedPet) <= 0) {
    return {
      ok: false,
      message: "❌ This pet has no sell value.",
    };
  }

  return {
    ok: true,
  };
}

function sellPet(player = {}, petId) {
  const pets = normalizePets(player.pets || []);
  const index = findPetIndex(pets, petId);

  if (index === -1) {
    return {
      ok: false,
      message: "❌ You don’t have that pet.",
    };
  }

  const pet = pets[index];
  const activePetId = player.activePetId || getActivePet(player)?.id || null;
  const sellCheck = canSellPet(pet, activePetId);

  if (!sellCheck.ok) return sellCheck;

  const sellPrice = getPetSellPrice(pet);

  pets.splice(index, 1);

  return {
    ok: true,
    pet,
    pets,
    sellPrice,
  };
}

function bulkSellPets(player = {}, qualityFilter = null) {
  const normalizedQualityFilter = qualityFilter
    ? normalizeQuality(qualityFilter)
    : null;

  const activePetId = player.activePetId || getActivePet(player)?.id || null;

  const result = {
    ok: true,
    pets: [],
    soldPets: [],
    totalGold: 0,
    commonSold: 0,
    rareSold: 0,
    legendarySold: 0,
  };

  for (const pet of normalizePets(player.pets || [])) {
    const matchesQuality =
      !normalizedQualityFilter || pet.quality === normalizedQualityFilter;

    const canSell = canSellPet(pet, activePetId).ok;

    if (!matchesQuality || !canSell) {
      result.pets.push(pet);
      continue;
    }

    const sellPrice = getPetSellPrice(pet);

    result.soldPets.push({
      pet,
      sellPrice,
    });

    result.totalGold += sellPrice;

    if (pet.quality === "Rare") {
      result.rareSold++;
    } else if (pet.quality === "Legendary") {
      result.legendarySold++;
    } else {
      result.commonSold++;
    }
  }

  if (result.soldPets.length === 0) {
    return {
      ok: false,
      message: "❌ No sellable pets found.",
    };
  }

  return result;
}

function canTradePet(pet = {}, activePetId = null) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) {
    return {
      ok: false,
      message: "❌ Pet not found.",
    };
  }

  if (normalizeId(normalizedPet.id) === normalizeId(activePetId)) {
    return {
      ok: false,
      message: "❌ You cannot trade your active pet. Unequip it first.",
    };
  }

  if (isPetLocked(normalizedPet)) {
    return {
      ok: false,
      message: "🔒 This pet is locked. Unlock it first before trading.",
    };
  }

  return {
    ok: true,
  };
}

function normalizeTradePets(pets = []) {
  return normalizePets(pets).map((pet) => ({
    ...cleanPetForStorage(pet),
    active: false,
  }));
}

function addPetToTradeOffer(offerPets = [], pet = {}) {
  const normalizedOfferPets = normalizeTradePets(offerPets);
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) return normalizedOfferPets;

  const exists = normalizedOfferPets.some(
    (existingPet) => existingPet.id === normalizedPet.id
  );

  if (exists) return normalizedOfferPets;

  normalizedOfferPets.push({
    ...cleanPetForStorage(normalizedPet),
    active: false,
  });

  return normalizedOfferPets;
}

function removePetFromTradeOffer(offerPets = [], petId) {
  const targetId = normalizeId(petId);

  return normalizeTradePets(offerPets).filter((pet) => {
    return (
      normalizeId(pet.id) !== targetId &&
      normalizeId(pet.basePetId) !== targetId
    );
  });
}

function hasPetsForTrade(player = {}, tradePets = []) {
  const playerPets = normalizePets(player.pets || []);

  return normalizeTradePets(tradePets).every((tradePet) => {
    return playerPets.some((pet) => pet.id === tradePet.id);
  });
}

function removePetFromPlayerPets(pets = [], petId) {
  const normalizedPets = normalizePets(pets);
  const index = findPetIndex(normalizedPets, petId);

  if (index === -1) {
    return {
      ok: false,
      pets: normalizedPets,
    };
  }

  const [pet] = normalizedPets.splice(index, 1);

  return {
    ok: true,
    pet,
    pets: normalizedPets,
  };
}

function formatPetStats(stats = {}) {
  const parts = [];

  if (stats.attack) parts.push(`⚔️ +${stats.attack}`);
  if (stats.defense) parts.push(`🛡️ +${stats.defense}`);
  if (stats.maxHp) parts.push(`❤️ +${stats.maxHp}`);
  if (stats.dodge) parts.push(`💨 +${stats.dodge}%`);
  if (stats.crit) parts.push(`💥 +${stats.crit}%`);

  return parts.length ? parts.join(" • ") : "No bonus stats";
}

function formatPetStatus(pet = {}, activePetId = null) {
  const active =
    normalizeId(pet.id) === normalizeId(activePetId) ||
    pet.active === true;

  const activeText = active ? "⭐ Active" : "📦 Stored";
  const lockText = isPetLocked(pet) ? "🔒 Locked" : "🔓 Unlocked";

  return `${activeText} • ${lockText}`;
}

function formatPetDisplay(pet = {}, player = {}) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) return "No pet.";

  const maxLevel = getPetMaxLevel(normalizedPet);
  const petStats = calculatePetStats(normalizedPet);
  const expDisplay = getPetExpDisplay(normalizedPet);

  return (
    `${normalizedPet.emoji || "🐾"} **${normalizedPet.name || "Unknown Pet"}**\n` +
    `Quality: **${normalizedPet.qualityEmoji || getQualityEmoji(normalizedPet.quality)} ${normalizedPet.quality}**\n` +
    `Level: **${normalizedPet.level}/${maxLevel}**\n` +
    `EXP: **${expDisplay}**\n` +
    `Type: **${String(normalizedPet.type || "balanced").toUpperCase()}**\n` +
    `Status: **${formatPetStatus(normalizedPet, player.activePetId)}**\n` +
    `ID: \`${normalizedPet.id}\`\n\n` +
    `Passive Bonus:\n${formatPetStats(petStats)}`
  );
}

function formatDroppedPet(pet = {}) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) return "";

  return (
    `\n🐾 **PET DROP!**\n` +
    `${normalizedPet.emoji || "🐾"} **${normalizedPet.name}**\n` +
    `🏷️ ID: \`${normalizedPet.id}\`\n` +
    `⭐ Quality: **${normalizedPet.qualityEmoji} ${normalizedPet.quality}**\n` +
    `📈 Level: **${normalizedPet.level}/${getPetMaxLevel(normalizedPet)}**\n` +
    `🔓 Status: **Unlocked**\n` +
    `📊 ${formatPetStats(calculatePetStats(normalizedPet))}\n`
  );
}

function getFilterLabel(filter = "all") {
  const normalized = String(filter || "all").toLowerCase();

  const labels = {
    all: "All Pets",
    active: "Active Pet",
    locked: "Locked Pets",
    unlocked: "Unlocked Pets",
    common: "Common Pets",
    rare: "Rare Pets",
    legendary: "Legendary Pets",
    attack: "Attack Pets",
    tank: "Tank Pets",
    support: "Support Pets",
    critical: "Critical Pets",
    evasion: "Evasion Pets",
    balanced: "Balanced Pets",
  };

  return labels[normalized] || "All Pets";
}

function filterPets(pets = [], filter = "all", activePetId = null) {
  const normalizedFilter = String(filter || "all").toLowerCase();
  const normalizedPets = normalizePets(pets || []);

  if (normalizedFilter === "all") return normalizedPets;

  if (normalizedFilter === "active") {
    return normalizedPets.filter(
      (pet) =>
        normalizeId(pet.id) === normalizeId(activePetId) ||
        pet.active === true
    );
  }

  if (normalizedFilter === "locked") {
    return normalizedPets.filter((pet) => isPetLocked(pet));
  }

  if (normalizedFilter === "unlocked") {
    return normalizedPets.filter((pet) => !isPetLocked(pet));
  }

  if (["common", "rare", "legendary"].includes(normalizedFilter)) {
    return normalizedPets.filter(
      (pet) => String(pet.quality || "").toLowerCase() === normalizedFilter
    );
  }

  if (
    ["attack", "tank", "support", "critical", "evasion", "balanced"].includes(
      normalizedFilter
    )
  ) {
    return normalizedPets.filter(
      (pet) => String(pet.type || "").toLowerCase() === normalizedFilter
    );
  }

  return null;
}

function sortPets(pets = []) {
  const qualityOrder = {
    Legendary: 1,
    Rare: 2,
    Common: 3,
  };

  const typeOrder = {
    attack: 1,
    critical: 2,
    evasion: 3,
    balanced: 4,
    tank: 5,
    support: 6,
  };

  return normalizePets(pets).sort((a, b) => {
    const qualityA = qualityOrder[a.quality] || 99;
    const qualityB = qualityOrder[b.quality] || 99;

    if (qualityA !== qualityB) return qualityA - qualityB;

    const levelA = Number(a.level || 1);
    const levelB = Number(b.level || 1);

    if (levelA !== levelB) return levelB - levelA;

    const typeA = typeOrder[String(a.type || "").toLowerCase()] || 99;
    const typeB = typeOrder[String(b.type || "").toLowerCase()] || 99;

    if (typeA !== typeB) return typeA - typeB;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function paginatePets(pets = [], page = 1, perPage = DEFAULT_PETS_PER_PAGE) {
  const totalPages = Math.max(1, Math.ceil(pets.length / perPage));
  const safePage = Math.min(Math.max(1, Number(page || 1)), totalPages);

  const start = (safePage - 1) * perPage;
  const end = start + perPage;

  return {
    pets: pets.slice(start, end),
    page: safePage,
    totalPages,
  };
}

function formatPetListPage({
  pets = [],
  filter = "all",
  page = 1,
  totalPages = 1,
  activePetId = null,
}) {
  const safePets = normalizePets(pets);
  const filterLabel = getFilterLabel(filter);

  const body = safePets.length
    ? safePets
        .map((pet, index) => {
          const maxLevel = getPetMaxLevel(pet);

          return (
            `**${index + 1}.** ${formatPetStatus(pet, activePetId)}\n` +
            `${pet.emoji || "🐾"} **${pet.name}**\n` +
            `└ ${pet.qualityEmoji || getQualityEmoji(pet.quality)} ${pet.quality} • ${String(pet.type || "balanced").toUpperCase()}\n` +
            `└ 📈 Lv.${pet.level}/${maxLevel} • EXP ${getPetExpDisplay(pet)}\n` +
            `└ 📊 ${formatPetStats(calculatePetStats(pet))}\n` +
            `└ 🏷️ ID: \`${pet.id}\``
          );
        })
        .join("\n\n")
    : "No pets found for this filter.";

  return (
    `🐾 **SYXTH PETS**\n` +
    `Filter: **${filterLabel}**\n` +
    `Page: **${page}/${totalPages}**\n\n` +
    `${body}\n\n` +
    `Commands:\n` +
    `\`!s pet info <pet_id>\`\n` +
    `\`!s pet equip <pet_id>\`\n` +
    `\`!s pet lock <pet_id>\` / \`!s pet unlock <pet_id>\`\n` +
    `\`!s pet sell <pet_id>\`\n` +
    `\`!s pet list <filter> <page>\``
  );
}

function formatTradePet(pet = {}) {
  const normalizedPet = normalizePet(pet);

  if (!normalizedPet) return "Unknown pet";

  return (
    `${normalizedPet.emoji || "🐾"} **${normalizedPet.name || "Unknown Pet"}**\n` +
    `└ ${normalizedPet.qualityEmoji || getQualityEmoji(normalizedPet.quality)} ${normalizedPet.quality} • ${String(normalizedPet.type || "balanced").toUpperCase()}\n` +
    `└ 📈 Lv.${normalizedPet.level}/${getPetMaxLevel(normalizedPet)}\n` +
    `└ ${isPetLocked(normalizedPet) ? "🔒 Locked" : "🔓 Unlocked"}\n` +
    `└ 📊 ${formatPetStats(calculatePetStats(normalizedPet))}\n` +
    `└ 🏷️ ID: \`${normalizedPet.id || "no-id"}\``
  );
}

function formatTradePets(pets = []) {
  const safePets = normalizeTradePets(pets);

  if (!safePets.length) return "No pets offered.";

  return safePets
    .map((pet, index) => `**${index + 1}.** ${formatTradePet(pet)}`)
    .join("\n\n");
}

module.exports = {
  DEFAULT_PETS_PER_PAGE,

  normalizeId,
  getArray,
  normalizeQuality,
  rollChance,

  rollPetStats,
  createPet,
  generateMonsterPetDrop,
  generateBossPetDrop,

  normalizePet,
  normalizePets,
  cleanPetForStorage,
  addPetToPets,
  addPetToPlayer,

  findPlayerPet,
  findPetIndex,
  getActivePet,

  equipPet,
  unequipPet,

  isPetLocked,
  lockPet,
  unlockPet,

  getPetMaxLevel,
  getPetRequiredExp,
  getPetExpDisplay,
  applyPetLevelUp,
  addPetExpToActivePet,

  calculatePetStats,
  applyPetStats,

  getPetSellPrice,
  canSellPet,
  sellPet,
  bulkSellPets,

  canTradePet,
  normalizeTradePets,
  addPetToTradeOffer,
  removePetFromTradeOffer,
  hasPetsForTrade,
  removePetFromPlayerPets,

  formatPetStats,
  formatPetStatus,
  formatPetDisplay,
  formatDroppedPet,

  filterPets,
  sortPets,
  paginatePets,
  formatPetListPage,

  formatTradePet,
  formatTradePets,
};