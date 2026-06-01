const balanceConfig = require("../balanceConfig");
const { getQualityEmoji } = require("../../utils/qualitySystem");

function getPotionPrice() {
  return Number(
    balanceConfig.consumables?.hpPotion?.price ||
      balanceConfig.economy?.hpPotionPrice ||
      100
  );
}

function getPotionHealPercent() {
  return Number(
    balanceConfig.consumables?.hpPotion?.healPercent ||
      balanceConfig.consumables?.hpPotionHealPercent ||
      50
  );
}

const consumables = [
  {
    id: "hp_potion",
    baseItemId: "hp_potion",
    name: "HP Potion",
    type: "Consumable",

    quality: "Common",
    qualityEmoji: getQualityEmoji("Common"),

    requiredLevel: 1,
    compatibleClasses: ["all"],

    price: getPotionPrice(),

    description: `Restores ${getPotionHealPercent()}% HP`,
    healPercent: getPotionHealPercent(),
    healAmount: 0,

    stats: {
      attack: 0,
      defense: 0,
      maxHp: 0,
      dodge: 0,
      crit: 0,
    },

    quantity: 1,
    source: "shop",
    emoji: "🧪",
  },
];

module.exports = consumables;