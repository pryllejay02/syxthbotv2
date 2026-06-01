const consumables = require("./shop/consumables");
const swordsmanItems = require("./shop/swordsmanItems");
const archerItems = require("./shop/archerItems");
const assassinItems = require("./shop/assassinItems");
const tankerItems = require("./shop/tankerItems");

const allShopItems = [
  ...consumables,
  ...swordsmanItems,
  ...archerItems,
  ...assassinItems,
  ...tankerItems,
];

function normalizeShopItem(item) {
  return {
    ...item,

    id: item.id,
    baseItemId: item.baseItemId || item.id,

    name: item.name || "Unknown Item",
    type: item.type || "Unknown",

    quality: item.quality || "Common",
    qualityEmoji: item.qualityEmoji || "",

    requiredLevel: Number(item.requiredLevel || 1),
    compatibleClasses: item.compatibleClasses || ["all"],

    price: Number(item.price || 0),

    description: item.description || "",

    healPercent: Number(item.healPercent || 0),
    healAmount: Number(item.healAmount || item.heal || 0),

    stats: item.stats || {
      attack: 0,
      defense: 0,
      maxHp: 0,
      dodge: 0,
      crit: 0,
    },

    quantity: Number(item.quantity || 1),
    source: item.source || "shop",
    emoji: item.emoji || "📦",
  };
}

function removeDuplicateItems(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    if (!item.id) return false;

    const key = String(item.id).toLowerCase();

    if (seen.has(key)) {
      console.warn(`Duplicate shop item ID skipped: ${item.id}`);
      return false;
    }

    seen.add(key);
    return true;
  });
}

const shopItems = removeDuplicateItems(allShopItems).map(normalizeShopItem);

module.exports = shopItems;