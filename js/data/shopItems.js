const consumables = require("./shop/consumables");
const swordsmanItems = require("./shop/swordsmanItems");
const archerItems = require("./shop/archerItems");
const assassinItems = require("./shop/assassinItems");
const tankerItems = require("./shop/tankerItems");
const { getQualityEmoji } = require("../utils/qualitySystem");

function getDefaultStats() {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
    dodge: 0,
    crit: 0,
  };
}

function normalizeStats(stats = {}) {
  return {
    attack: Math.floor(Number(stats.attack || 0)),
    defense: Math.floor(Number(stats.defense || 0)),
    maxHp: Math.floor(Number(stats.maxHp || 0)),
    dodge: Number(Number(stats.dodge || 0).toFixed(1)),
    crit: Number(Number(stats.crit || 0).toFixed(1)),
  };
}

function normalizeQuality(quality = "Common") {
  const normalized = String(quality || "Common");

  if (["Starter", "Common", "Rare", "Legendary"].includes(normalized)) {
    return normalized;
  }

  return "Common";
}

function normalizeType(type = "Unknown") {
  const normalized = String(type || "Unknown").toLowerCase();

  const typeMap = {
    weapon: "Weapon",
    helmet: "Helmet",
    armor: "Armor",
    gloves: "Gloves",
    pants: "Pants",
    boots: "Boots",
    consumable: "Consumable",
  };

  return typeMap[normalized] || String(type || "Unknown");
}

function isConsumable(item = {}) {
  return String(item.type || "").toLowerCase() === "consumable";
}

function normalizeCompatibleClasses(classes) {
  if (!Array.isArray(classes) || classes.length === 0) {
    return ["all"];
  }

  return [...new Set(classes.map((cls) => String(cls || "all").toLowerCase()))];
}

function normalizeShopItem(item = {}) {
  const quality = normalizeQuality(item.quality || "Common");
  const type = normalizeType(item.type || "Unknown");
  const consumable = isConsumable({
    ...item,
    type,
  });

  return {
    ...item,

    id: String(item.id || "").trim(),
    baseItemId: item.baseItemId || item.id,

    name: item.name || "Unknown Item",
    type,

    quality,
    qualityEmoji: item.qualityEmoji || getQualityEmoji(quality),

    requiredLevel: Number(item.requiredLevel || 1),
    compatibleClasses: normalizeCompatibleClasses(item.compatibleClasses),

    price: Math.max(0, Math.floor(Number(item.price || 0))),

    description: item.description || "",

    healPercent: consumable ? Number(item.healPercent || 0) : 0,
    healAmount: consumable
      ? Number(item.healAmount || item.heal || 0)
      : 0,

    stats: consumable
      ? getDefaultStats()
      : normalizeStats(item.stats || getDefaultStats()),

    quantity: Math.max(1, Number(item.quantity || 1)),
    source: item.source || "shop",
    emoji: item.emoji || (consumable ? "🧪" : "📦"),
  };
}

function removeDuplicateItems(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    if (!item || !item.id) {
      console.warn("Shop item skipped because it has no ID.");
      return false;
    }

    const key = String(item.id).toLowerCase().trim();

    if (seen.has(key)) {
      console.warn(`Duplicate shop item ID skipped: ${item.id}`);
      return false;
    }

    seen.add(key);
    return true;
  });
}

const allShopItems = [
  ...consumables,
  ...swordsmanItems,
  ...archerItems,
  ...assassinItems,
  ...tankerItems,
];

const shopItems = removeDuplicateItems(allShopItems).map(normalizeShopItem);

module.exports = shopItems;