const { db } = require("../../firebase/firebase");

const tradeConfig = require("../data/tradeConfig");
const shopItems = require("../data/shopItems");
const balanceConfig = require("../data/balanceConfig");
const { getQualityEmoji } = require("../utils/qualitySystem");

const {
  getMentionedUser,
  getPlayer,
  findActiveTrade,
  formatTradeWindow,
} = require("../utils/tradeUtils");

const {
  createPrivateTradeChannel,
  deleteTradeChannel,
  getTradeSide,
} = require("../services/tradeService");

const {
  normalizePets,
  normalizeTradePets,
  getActivePet,
  findPlayerPet: findPlayerPetById,
  canTradePet,
  addPetToTradeOffer,
  removePetFromTradeOffer,
  removePetFromPlayerPets,
  addPetToPets,
  formatTradePets,
} = require("../utils/petSystem");

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
}

function getDeleteChannelDelayMs() {
  return Number(tradeConfig.deleteChannelDelayMs || 5000);
}

function getInviteExpireMs() {
  return Number(tradeConfig.inviteExpireMs || 120000);
}

function isValidQuantity(quantity) {
  return Number.isInteger(quantity) && quantity > 0;
}

function parseQuantity(value, fallback = 1) {
  const quantity = Number(value || fallback);

  if (!isValidQuantity(quantity)) return null;

  return quantity;
}

function parseGoldAmount(value) {
  const amount = Number(value || 0);

  if (!Number.isInteger(amount)) return null;
  if (amount < 0) return null;

  return amount;
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

function normalizeTradeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .filter(Boolean)
    .map((item) => rebalanceItemStats(item))
    .filter(Boolean)
    .filter((item) => !isStarterItem(item))
    .map((item) => ({
      ...item,
      quantity: Math.max(1, Number(item.quantity || 1)),
    }));
}

function getItemMatchScore(invItem = {}, targetItem = {}) {
  const invId = normalizeId(invItem.id);
  const targetId = normalizeId(targetItem.id);

  const invBaseId = normalizeId(invItem.baseItemId);
  const targetBaseId = normalizeId(targetItem.baseItemId);

  if (invId && targetId && invId === targetId) return 3;

  if (invBaseId && targetBaseId && invBaseId === targetBaseId) return 2;

  if (invId && targetBaseId && invId === targetBaseId) return 1;

  if (invBaseId && targetId && invBaseId === targetId) return 1;

  return 0;
}

function sameStats(a = {}, b = {}) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

function findInventoryIndexByItem(inventory = [], targetItem = {}) {
  let bestIndex = -1;
  let bestScore = 0;

  inventory.forEach((item, index) => {
    if (!item) return;

    const score = getItemMatchScore(item, targetItem);

    if (score <= 0) return;

    const sameQuality =
      String(item.quality || "") === String(targetItem.quality || "");

    const sameItemStats = sameStats(item.stats || {}, targetItem.stats || {});

    if (!isConsumable(targetItem) && (!sameQuality || !sameItemStats)) {
      return;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function findInventoryItem(player = {}, itemId) {
  const inventory = normalizeInventory(player.inventory || []);
  const targetId = normalizeId(itemId);

  return inventory.find((item) => {
    if (!item) return false;

    const id = normalizeId(item.id);
    const baseItemId = normalizeId(item.baseItemId);

    return id === targetId || baseItemId === targetId;
  });
}

function removeItemFromInventory(inventory = [], tradeItem = {}, quantity = 1) {
  const index = findInventoryIndexByItem(inventory, tradeItem);

  if (index === -1) return false;

  const ownedQty = Number(inventory[index].quantity || 1);

  if (ownedQty < quantity) return false;

  if (ownedQty > quantity) {
    inventory[index] = {
      ...inventory[index],
      quantity: ownedQty - quantity,
    };
  } else {
    inventory.splice(index, 1);
  }

  return true;
}

function addItemToInventory(inventory = [], item = {}) {
  const normalizedItem = rebalanceItemStats(item);

  if (!normalizedItem) return inventory;

  const quantity = Math.max(1, Number(normalizedItem.quantity || 1));

  const existingIndex = inventory.findIndex((invItem) => {
    if (!invItem) return false;

    if (isConsumable(normalizedItem)) {
      return normalizeId(invItem.id) === normalizeId(normalizedItem.id);
    }

    return (
      normalizeId(invItem.baseItemId || invItem.id) ===
        normalizeId(normalizedItem.baseItemId || normalizedItem.id) &&
      invItem.quality === normalizedItem.quality &&
      sameStats(invItem.stats || {}, normalizedItem.stats || {})
    );
  });

  if (existingIndex !== -1) {
    inventory[existingIndex].quantity =
      Number(inventory[existingIndex].quantity || 1) + quantity;
  } else {
    inventory.push({
      ...normalizedItem,
      quantity,
    });
  }

  return inventory;
}

function hasEnoughInventory(inventory = [], tradeItems = []) {
  const workingInventory = normalizeInventory(inventory);

  for (const tradeItem of normalizeTradeItems(tradeItems)) {
    const requiredQty = Number(tradeItem.quantity || 1);
    const index = findInventoryIndexByItem(workingInventory, tradeItem);

    if (index === -1) return false;

    const ownedQty = Number(workingInventory[index].quantity || 1);

    if (ownedQty < requiredQty) return false;
  }

  return true;
}

function isItemEquipped(player = {}, itemId) {
  const targetId = normalizeId(itemId);
  const equipment = player.equipment || {};

  return Object.values(equipment).some((item) => {
    if (!item) return false;

    return (
      normalizeId(item.id) === targetId ||
      normalizeId(item.baseItemId) === targetId
    );
  });
}

function hasEquippedTradeItem(player = {}, tradeItems = []) {
  return normalizeTradeItems(tradeItems).some(
    (item) =>
      isItemEquipped(player, item.id) ||
      isItemEquipped(player, item.baseItemId)
  );
}

function getOfferQuantity(items = [], itemId) {
  const targetId = normalizeId(itemId);

  return normalizeTradeItems(items)
    .filter((item) => {
      const id = normalizeId(item.id);
      const baseItemId = normalizeId(item.baseItemId);

      return id === targetId || baseItemId === targetId;
    })
    .reduce((total, item) => total + Number(item.quantity || 1), 0);
}

function addItemToOffer(items = [], item = {}, quantity = 1) {
  const normalizedItem = rebalanceItemStats(item);

  if (!normalizedItem) return normalizeTradeItems(items);

  const safeQuantity = Math.max(1, Number(quantity || 1));
  const currentItems = normalizeTradeItems(items);

  const existingIndex = currentItems.findIndex((offerItem) => {
    return (
      normalizeId(offerItem.id) === normalizeId(normalizedItem.id) &&
      offerItem.quality === normalizedItem.quality &&
      sameStats(offerItem.stats || {}, normalizedItem.stats || {})
    );
  });

  if (existingIndex !== -1) {
    currentItems[existingIndex].quantity =
      Number(currentItems[existingIndex].quantity || 1) + safeQuantity;
  } else {
    currentItems.push({
      ...normalizedItem,
      quantity: safeQuantity,
    });
  }

  return currentItems;
}

function removeItemFromOffer(items = [], itemId) {
  const targetId = normalizeId(itemId);

  return normalizeTradeItems(items).filter((item) => {
    const id = normalizeId(item.id);
    const baseItemId = normalizeId(item.baseItemId);

    return id !== targetId && baseItemId !== targetId;
  });
}

function getPlayerActivePetId(player = {}) {
  const activePet = getActivePet({
    ...player,
    pets: player.pets || [],
    activePetId: player.activePetId || null,
  });

  return player.activePetId || activePet?.id || null;
}

function normalizeTradeForDisplay(trade = {}) {
  return {
    ...trade,
    player1Items: normalizeTradeItems(trade.player1Items || []),
    player2Items: normalizeTradeItems(trade.player2Items || []),
    player1Pets: normalizeTradePets(trade.player1Pets || []),
    player2Pets: normalizeTradePets(trade.player2Pets || []),
  };
}

function formatTradeWindowWithPets(trade = {}) {
  const normalizedTrade = normalizeTradeForDisplay(trade);
  const baseWindow = formatTradeWindow(normalizedTrade);

  const player1Pets = normalizeTradePets(normalizedTrade.player1Pets || []);
  const player2Pets = normalizeTradePets(normalizedTrade.player2Pets || []);

  if (!player1Pets.length && !player2Pets.length) {
    return baseWindow;
  }

  return (
    `${baseWindow}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🐾 **PET OFFERS**\n\n` +
    `👤 **${normalizedTrade.player1Username || "Player 1"} Pets**\n` +
    `${formatTradePets(player1Pets)}\n\n` +
    `👤 **${normalizedTrade.player2Username || "Player 2"} Pets**\n` +
    `${formatTradePets(player2Pets)}`
  );
}

function resetConfirmationsPayload() {
  return {
    status: "active",
    player1Confirmed: false,
    player2Confirmed: false,
    updatedAt: new Date(),
  };
}

function getPetsKey(side = {}) {
  return side.petsKey || (side.side === "player1" ? "player1Pets" : "player2Pets");
}

async function scheduleTradeChannelDelete(guild, channelId) {
  setTimeout(async () => {
    await deleteTradeChannel(guild, channelId).catch(() => null);
  }, getDeleteChannelDelayMs()).unref?.();
}

async function completeTrade(message, trade) {
  const tradeRef = db.collection("trades").doc(trade.id);
  const player1Ref = db.collection("players").doc(trade.player1Id);
  const player2Ref = db.collection("players").doc(trade.player2Id);

  const result = await db.runTransaction(async (transaction) => {
    const latestTradeDoc = await transaction.get(tradeRef);
    const player1Doc = await transaction.get(player1Ref);
    const player2Doc = await transaction.get(player2Ref);

    if (!latestTradeDoc.exists) {
      return {
        ok: false,
        message: "❌ This trade no longer exists.",
      };
    }

    const latestTrade = {
      id: latestTradeDoc.id,
      ...latestTradeDoc.data(),
    };

    if (latestTrade.status === "completed") {
      return {
        ok: false,
        message: "❌ This trade is already completed.",
      };
    }

    if (latestTrade.status === "processing") {
      return {
        ok: false,
        message: "⏳ Trade is already processing.",
      };
    }

    if (latestTrade.status !== "active") {
      return {
        ok: false,
        message: "❌ This trade is not active.",
      };
    }

    if (!latestTrade.player1Confirmed || !latestTrade.player2Confirmed) {
      return {
        ok: false,
        message: "❌ Both players must confirm before the trade can complete.",
      };
    }

    if (!player1Doc.exists || !player2Doc.exists) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ One of the players no longer has a character. Confirmations reset.",
      };
    }

    const player1 = player1Doc.data();
    const player2 = player2Doc.data();

    const p1Inventory = normalizeInventory(player1.inventory || []);
    const p2Inventory = normalizeInventory(player2.inventory || []);

    let p1Pets = normalizePets(player1.pets || []);
    let p2Pets = normalizePets(player2.pets || []);

    const player1Items = normalizeTradeItems(latestTrade.player1Items || []);
    const player2Items = normalizeTradeItems(latestTrade.player2Items || []);

    const player1Pets = normalizeTradePets(latestTrade.player1Pets || []);
    const player2Pets = normalizeTradePets(latestTrade.player2Pets || []);

    const p1Gold = Number(player1.gold || 0);
    const p2Gold = Number(player2.gold || 0);

    const player1GoldOffer = Number(latestTrade.player1Gold || 0);
    const player2GoldOffer = Number(latestTrade.player2Gold || 0);

    if (p1Gold < player1GoldOffer) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 1 does not have enough gold anymore. Confirmations reset.",
      };
    }

    if (p2Gold < player2GoldOffer) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 2 does not have enough gold anymore. Confirmations reset.",
      };
    }

    if (!hasEnoughInventory(p1Inventory, player1Items)) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 1 no longer has the required item(s). Confirmations reset.",
      };
    }

    if (!hasEnoughInventory(p2Inventory, player2Items)) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 2 no longer has the required item(s). Confirmations reset.",
      };
    }

    if (hasEquippedTradeItem(player1, player1Items)) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 1 has a trade item equipped. Unequip it first. Confirmations reset.",
      };
    }

    if (hasEquippedTradeItem(player2, player2Items)) {
      transaction.update(tradeRef, resetConfirmationsPayload());

      return {
        ok: false,
        message:
          "❌ Player 2 has a trade item equipped. Unequip it first. Confirmations reset.",
      };
    }

    for (const tradePet of player1Pets) {
      const ownedPet = findPlayerPetById(player1, tradePet.id);
      const tradeCheck = canTradePet(ownedPet, getPlayerActivePetId(player1));

      if (!ownedPet || !tradeCheck.ok) {
        transaction.update(tradeRef, resetConfirmationsPayload());

        return {
          ok: false,
          message:
            "❌ Player 1 no longer has a valid trade pet. Confirmations reset.",
        };
      }
    }

    for (const tradePet of player2Pets) {
      const ownedPet = findPlayerPetById(player2, tradePet.id);
      const tradeCheck = canTradePet(ownedPet, getPlayerActivePetId(player2));

      if (!ownedPet || !tradeCheck.ok) {
        transaction.update(tradeRef, resetConfirmationsPayload());

        return {
          ok: false,
          message:
            "❌ Player 2 no longer has a valid trade pet. Confirmations reset.",
        };
      }
    }

    for (const item of player1Items) {
      const removed = removeItemFromInventory(
        p1Inventory,
        item,
        Number(item.quantity || 1)
      );

      if (!removed) {
        transaction.update(tradeRef, resetConfirmationsPayload());

        return {
          ok: false,
          message:
            "❌ Failed to remove Player 1 item during trade. Confirmations reset.",
        };
      }

      addItemToInventory(p2Inventory, item);
    }

    for (const item of player2Items) {
      const removed = removeItemFromInventory(
        p2Inventory,
        item,
        Number(item.quantity || 1)
      );

      if (!removed) {
        transaction.update(tradeRef, resetConfirmationsPayload());

        return {
          ok: false,
          message:
            "❌ Failed to remove Player 2 item during trade. Confirmations reset.",
        };
      }

      addItemToInventory(p1Inventory, item);
    }

    for (const pet of player1Pets) {
      const removed = removePetFromPlayerPets(p1Pets, pet.id);

      if (!removed.ok) {
        transaction.update(tradeRef, resetConfirmationsPayload());

        return {
          ok: false,
          message:
            "❌ Failed to remove Player 1 pet during trade. Confirmations reset.",
        };
      }

      p1Pets = removed.pets;
      p2Pets = addPetToPets(p2Pets, {
        ...removed.pet,
        active: false,
      });
    }

    for (const pet of player2Pets) {
      const removed = removePetFromPlayerPets(p2Pets, pet.id);

      if (!removed.ok) {
        transaction.update(tradeRef, resetConfirmationsPayload());

        return {
          ok: false,
          message:
            "❌ Failed to remove Player 2 pet during trade. Confirmations reset.",
        };
      }

      p2Pets = removed.pets;
      p1Pets = addPetToPets(p1Pets, {
        ...removed.pet,
        active: false,
      });
    }

    transaction.update(player1Ref, {
      inventory: p1Inventory,
      pets: p1Pets,
      gold: p1Gold - player1GoldOffer + player2GoldOffer,
      updatedAt: new Date(),
    });

    transaction.update(player2Ref, {
      inventory: p2Inventory,
      pets: p2Pets,
      gold: p2Gold - player2GoldOffer + player1GoldOffer,
      updatedAt: new Date(),
    });

    transaction.delete(tradeRef);

    return {
      ok: true,
      trade: latestTrade,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Trade failed.");
  }

  await message.channel.send(
    `🎉 **TRADE COMPLETED!**\n\n` +
      `<@${result.trade.player1Id}> and <@${result.trade.player2Id}> successfully traded.\n\n` +
      `This trade room will be deleted shortly.`
  );

  await scheduleTradeChannelDelete(message.guild, result.trade.channelId);

  return null;
}

module.exports = async function tradeCommand(message, args = []) {
  const subCommand = String(args[0] || "").toLowerCase();
  const userId = message.author.id;

  if (!message.guild) {
    return message.reply("❌ Trade commands can only be used inside a server.");
  }

  if (!subCommand || message.mentions.users.size > 0) {
    if (message.channel.id !== tradeConfig.createTradeChannelId) {
      return message.reply(
        `❌ Trade invitations can only be created in <#${tradeConfig.createTradeChannelId}>.`
      );
    }

    const targetUser = getMentionedUser(message);

    if (!targetUser || targetUser.bot || targetUser.id === userId) {
      return message.reply(
        "❌ Please mention a valid player.\n\nExample: `!s trade @player`"
      );
    }

    const senderPlayer = await getPlayer(userId);
    const targetPlayer = await getPlayer(targetUser.id);

    if (!senderPlayer || !targetPlayer) {
      return message.reply("❌ Both players must have a character.");
    }

    if (senderPlayer.world?.id !== targetPlayer.world?.id) {
      return message.reply("❌ You can only trade with players in the same world.");
    }

    const senderActiveTrade = await findActiveTrade(userId);
    const targetActiveTrade = await findActiveTrade(targetUser.id);

    if (senderActiveTrade || targetActiveTrade) {
      return message.reply("❌ One of the players is already in a trade.");
    }

    const tradeRef = db.collection("trades").doc();
    const expiresAt = Date.now() + getInviteExpireMs();

    await tradeRef.set({
      tradeId: tradeRef.id,
      player1Id: userId,
      player2Id: targetUser.id,
      player1Username: senderPlayer.username || message.author.username,
      player2Username: targetPlayer.username || targetUser.username,
      player1Items: [],
      player2Items: [],
      player1Pets: [],
      player2Pets: [],
      player1Gold: 0,
      player2Gold: 0,
      player1Confirmed: false,
      player2Confirmed: false,
      status: "pending",
      channelId: null,
      worldId: senderPlayer.world?.id || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
    });

    const inviteSeconds = Math.ceil(getInviteExpireMs() / 1000);

    const inviteMessage = await message.reply(
      `🤝 <@${userId}> wants to trade with <@${targetUser.id}>.\n\n` +
        `<@${targetUser.id}>, type \`!s trade accept\` within **${inviteSeconds} seconds** to accept.\n` +
        `You can also type \`!s trade decline\`.`
    );

    setTimeout(async () => {
      const latestDoc = await tradeRef.get();

      if (!latestDoc.exists) return;

      const latestTrade = latestDoc.data();

      if (latestTrade.status === "pending") {
        await tradeRef.delete();

        await inviteMessage
          .reply("⏳ Trade invitation expired. No private trade room was created.")
          .catch(() => null);
      }
    }, getInviteExpireMs()).unref?.();

    return null;
  }

  if (subCommand === "accept") {
    const activeTrade = await findActiveTrade(userId);

    if (!activeTrade || activeTrade.status !== "pending") {
      return message.reply("❌ You don’t have any pending trade invitation.");
    }

    if (activeTrade.player2Id !== userId) {
      return message.reply("❌ Only the invited player can accept this trade.");
    }

    if (Date.now() > Number(activeTrade.expiresAt || 0)) {
      await db.collection("trades").doc(activeTrade.id).delete();

      return message.reply("⏳ This trade invitation already expired.");
    }

    const channel = await createPrivateTradeChannel(message, activeTrade);

    if (!channel) {
      return message.reply("❌ Failed to create private trade room.");
    }

    await db.collection("trades").doc(activeTrade.id).update({
      status: "active",
      channelId: channel.id,
      updatedAt: new Date(),
    });

    const openedTrade = normalizeTradeForDisplay({
      ...activeTrade,
      status: "active",
      channelId: channel.id,
    });

    await channel.send(formatTradeWindowWithPets(openedTrade));

    return message.reply(
      `✅ Trade accepted. Private trade room created: <#${channel.id}>`
    );
  }

  if (subCommand === "decline") {
    const activeTrade = await findActiveTrade(userId);

    if (!activeTrade || activeTrade.status !== "pending") {
      return message.reply("❌ You don’t have any pending trade invitation.");
    }

    if (activeTrade.player2Id !== userId) {
      return message.reply("❌ Only the invited player can decline this trade.");
    }

    await db.collection("trades").doc(activeTrade.id).delete();

    return message.reply("❌ Trade invitation declined.");
  }

  const activeTrade = await findActiveTrade(userId);

  if (!activeTrade || activeTrade.status !== "active") {
    return message.reply("❌ You are not inside an active trade.");
  }

  if (message.channel.id !== activeTrade.channelId) {
    return message.reply(
      `❌ Use trade commands inside <#${activeTrade.channelId}>.`
    );
  }

  const side = getTradeSide(activeTrade, userId);

  if (!side) {
    return message.reply("❌ You are not part of this trade.");
  }

  if (subCommand === "status") {
    return message.reply(formatTradeWindowWithPets(activeTrade));
  }

  if (subCommand === "add") {
    const itemId = args[1];
    const quantity = parseQuantity(args[2], 1);

    if (!itemId) {
      return message.reply("❌ Usage: `!s trade add <item_id> <qty>`");
    }

    if (!quantity) {
      return message.reply("❌ Quantity must be a whole number greater than 0.");
    }

    const tradeRef = db.collection("trades").doc(activeTrade.id);
    const playerRef = db.collection("players").doc(userId);

    const result = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);
      const playerDoc = await transaction.get(playerRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You no longer have a character.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const player = playerDoc.data();
      const normalizedInventory = normalizeInventory(player.inventory || []);

      const normalizedPlayer = {
        ...player,
        inventory: normalizedInventory,
      };

      const item = findInventoryItem(normalizedPlayer, itemId);

      if (!item) {
        transaction.update(playerRef, {
          inventory: normalizedInventory,
          updatedAt: new Date(),
        });

        return {
          ok: false,
          message: "❌ You don’t have that item.",
        };
      }

      if (isStarterItem(item)) {
        transaction.update(playerRef, {
          inventory: normalizedInventory,
          updatedAt: new Date(),
        });

        return {
          ok: false,
          message: "❌ Starter items cannot be traded.",
        };
      }

      if (isItemEquipped(player, item.id) || isItemEquipped(player, item.baseItemId)) {
        transaction.update(playerRef, {
          inventory: normalizedInventory,
          updatedAt: new Date(),
        });

        return {
          ok: false,
          message: "❌ You cannot trade an equipped item. Unequip it first.",
        };
      }

      const ownedQty = Number(item.quantity || 1);
      const currentItems = normalizeTradeItems(latestTrade[latestSide.itemsKey] || []);
      const alreadyAddedQty = getOfferQuantity(currentItems, item.id);

      if (alreadyAddedQty + quantity > ownedQty) {
        transaction.update(playerRef, {
          inventory: normalizedInventory,
          updatedAt: new Date(),
        });

        return {
          ok: false,
          message:
            `❌ You only have **${ownedQty}x** of this item, and **${alreadyAddedQty}x** is already in the trade.`,
        };
      }

      const updatedItems = addItemToOffer(currentItems, item, quantity);

      const updatedTrade = normalizeTradeForDisplay({
        ...latestTrade,
        [latestSide.itemsKey]: updatedItems,
        player1Confirmed: false,
        player2Confirmed: false,
      });

      transaction.update(tradeRef, {
        [latestSide.itemsKey]: updatedItems,
        ...resetConfirmationsPayload(),
      });

      transaction.update(playerRef, {
        inventory: normalizedInventory,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        item,
        quantity,
        trade: updatedTrade,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to add item.");
    }

    return message.reply(
      `✅ Added **${result.item.name} x${result.quantity}** to the trade.\n\n` +
        formatTradeWindowWithPets(result.trade)
    );
  }

  if (subCommand === "remove") {
    const itemId = args[1];

    if (!itemId) {
      return message.reply("❌ Usage: `!s trade remove <item_id>`");
    }

    const tradeRef = db.collection("trades").doc(activeTrade.id);

    const result = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const currentItems = normalizeTradeItems(latestTrade[latestSide.itemsKey] || []);
      const updatedItems = removeItemFromOffer(currentItems, itemId);

      if (updatedItems.length === currentItems.length) {
        return {
          ok: false,
          message: "❌ That item is not in your trade offer.",
        };
      }

      const updatedTrade = normalizeTradeForDisplay({
        ...latestTrade,
        [latestSide.itemsKey]: updatedItems,
        player1Confirmed: false,
        player2Confirmed: false,
      });

      transaction.update(tradeRef, {
        [latestSide.itemsKey]: updatedItems,
        ...resetConfirmationsPayload(),
      });

      return {
        ok: true,
        trade: updatedTrade,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to remove item.");
    }

    return message.reply(
      `✅ Removed item from trade.\n\n` +
        formatTradeWindowWithPets(result.trade)
    );
  }

  if (subCommand === "addpet") {
    const petId = args[1];

    if (!petId) {
      return message.reply("❌ Usage: `!s trade addpet <pet_id>`");
    }

    const tradeRef = db.collection("trades").doc(activeTrade.id);
    const playerRef = db.collection("players").doc(userId);

    const result = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);
      const playerDoc = await transaction.get(playerRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You no longer have a character.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const player = playerDoc.data();
      const pet = findPlayerPetById(player, petId);
      const tradeCheck = canTradePet(pet, getPlayerActivePetId(player));

      if (!pet || !tradeCheck.ok) {
        return {
          ok: false,
          message: tradeCheck.message || "❌ You don’t have that pet.",
        };
      }

      const petsKey = getPetsKey(latestSide);
      const currentPets = normalizeTradePets(latestTrade[petsKey] || []);

      if (currentPets.some((tradePet) => tradePet.id === pet.id)) {
        return {
          ok: false,
          message: "❌ That pet is already in your trade offer.",
        };
      }

      const updatedPets = addPetToTradeOffer(currentPets, pet);

      const updatedTrade = normalizeTradeForDisplay({
        ...latestTrade,
        [petsKey]: updatedPets,
        player1Confirmed: false,
        player2Confirmed: false,
      });

      transaction.update(tradeRef, {
        [petsKey]: updatedPets,
        ...resetConfirmationsPayload(),
      });

      return {
        ok: true,
        pet,
        trade: updatedTrade,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to add pet.");
    }

    return message.reply(
      `✅ Added ${result.pet.emoji || "🐾"} **${result.pet.name}** to the trade.\n\n` +
        formatTradeWindowWithPets(result.trade)
    );
  }

  if (subCommand === "removepet") {
    const petId = args[1];

    if (!petId) {
      return message.reply("❌ Usage: `!s trade removepet <pet_id>`");
    }

    const tradeRef = db.collection("trades").doc(activeTrade.id);

    const result = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const petsKey = getPetsKey(latestSide);
      const currentPets = normalizeTradePets(latestTrade[petsKey] || []);
      const updatedPets = removePetFromTradeOffer(currentPets, petId);

      if (updatedPets.length === currentPets.length) {
        return {
          ok: false,
          message: "❌ That pet is not in your trade offer.",
        };
      }

      const updatedTrade = normalizeTradeForDisplay({
        ...latestTrade,
        [petsKey]: updatedPets,
        player1Confirmed: false,
        player2Confirmed: false,
      });

      transaction.update(tradeRef, {
        [petsKey]: updatedPets,
        ...resetConfirmationsPayload(),
      });

      return {
        ok: true,
        trade: updatedTrade,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to remove pet.");
    }

    return message.reply(
      `✅ Removed pet from trade.\n\n` +
        formatTradeWindowWithPets(result.trade)
    );
  }

  if (subCommand === "gold") {
    const amount = parseGoldAmount(args[1]);

    if (amount === null) {
      return message.reply(
        "❌ Gold amount must be a whole number and cannot be negative."
      );
    }

    const tradeRef = db.collection("trades").doc(activeTrade.id);
    const playerRef = db.collection("players").doc(userId);

    const result = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);
      const playerDoc = await transaction.get(playerRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You no longer have a character.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const player = playerDoc.data();
      const playerGold = Number(player.gold || 0);

      if (playerGold < amount) {
        return {
          ok: false,
          message: `❌ You only have **${playerGold} Gold**.`,
        };
      }

      const updatedTrade = normalizeTradeForDisplay({
        ...latestTrade,
        [latestSide.goldKey]: amount,
        player1Confirmed: false,
        player2Confirmed: false,
      });

      transaction.update(tradeRef, {
        [latestSide.goldKey]: amount,
        ...resetConfirmationsPayload(),
      });

      return {
        ok: true,
        amount,
        trade: updatedTrade,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to update gold offer.");
    }

    return message.reply(
      `✅ Gold offer updated to **${result.amount} Gold**.\n\n` +
        formatTradeWindowWithPets(result.trade)
    );
  }

  if (subCommand === "confirm") {
    const tradeRef = db.collection("trades").doc(activeTrade.id);

    const confirmResult = await db.runTransaction(async (transaction) => {
      const tradeDoc = await transaction.get(tradeRef);

      if (!tradeDoc.exists) {
        return {
          ok: false,
          message: "❌ This trade no longer exists.",
        };
      }

      const latestTrade = {
        id: tradeDoc.id,
        ...tradeDoc.data(),
      };

      if (latestTrade.status !== "active") {
        return {
          ok: false,
          message: "❌ This trade is no longer active.",
        };
      }

      const latestSide = getTradeSide(latestTrade, userId);

      if (!latestSide) {
        return {
          ok: false,
          message: "❌ You are not part of this trade.",
        };
      }

      const updatedTrade = normalizeTradeForDisplay({
        ...latestTrade,
        [latestSide.confirmKey]: true,
      });

      transaction.update(tradeRef, {
        [latestSide.confirmKey]: true,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        trade: updatedTrade,
        bothConfirmed:
          updatedTrade.player1Confirmed && updatedTrade.player2Confirmed,
      };
    });

    if (!confirmResult.ok) {
      return message.reply(
        confirmResult.message || "❌ Trade confirmation failed."
      );
    }

    if (confirmResult.bothConfirmed) {
      return completeTrade(message, confirmResult.trade);
    }

    return message.reply(
      `✅ You confirmed the trade.\n\n` +
        `Waiting for the other player.\n\n` +
        formatTradeWindowWithPets(confirmResult.trade)
    );
  }

  if (subCommand === "cancel") {
    const channelId = activeTrade.channelId;

    await db.collection("trades").doc(activeTrade.id).delete();

    await message.reply(
      "🛑 Trade cancelled. This channel will be deleted shortly."
    );

    await scheduleTradeChannelDelete(message.guild, channelId);

    return null;
  }

  return message.reply(
    "❌ Unknown trade command.\n\n" +
      "`!s trade add <item_id> <qty>`\n" +
      "`!s trade remove <item_id>`\n" +
      "`!s trade addpet <pet_id>`\n" +
      "`!s trade removepet <pet_id>`\n" +
      "`!s trade gold <amount>`\n" +
      "`!s trade confirm`\n" +
      "`!s trade cancel`\n" +
      "`!s trade status`"
  );
};