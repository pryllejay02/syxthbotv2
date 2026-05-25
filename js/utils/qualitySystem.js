const QUALITIES = {
  Common: {
    emoji: "🟢",
    color: "#22C55E",
    statMultiplier: 1,
    priceMultiplier: 1,
  },

  Rare: {
    emoji: "🔵",
    color: "#3B82F6",
    statMultiplier: 1.5,
    priceMultiplier: 2,
  },

  Legendary: {
    emoji: "🟠",
    color: "#F59E0B",
    statMultiplier: 2.5,
    priceMultiplier: 5,
  },
};

function getQualityData(quality = "Common") {
  return QUALITIES[quality] || QUALITIES.Common;
}

function getQualityEmoji(quality = "Common") {
  return getQualityData(quality).emoji;
}

function formatItemName(item) {
  return `${getQualityEmoji(item.quality)} ${item.name}`;
}

module.exports = {
  QUALITIES,
  getQualityData,
  getQualityEmoji,
  formatItemName,
};