const balanceConfig = require("../data/balanceConfig");

const DEFAULT_QUALITIES = {
  Starter: {
    emoji: "🌱",
    color: "#9CA3AF",
    statMultiplier: 0,
    priceMultiplier: 0,
  },

  Common: {
    emoji: "🟢",
    color: "#22C55E",
    statMultiplier: 1,
    priceMultiplier: 1,
  },

  Rare: {
    emoji: "🔵",
    color: "#3B82F6",
    statMultiplier: 1.35,
    priceMultiplier: 2,
  },

  Legendary: {
    emoji: "🟠",
    color: "#F59E0B",
    statMultiplier: 1.8,
    priceMultiplier: 5,
  },
};

const QUALITIES = {
  ...DEFAULT_QUALITIES,
  ...(balanceConfig.quality || {}),
};

function normalizeQuality(quality = "Common") {
  const normalized = String(quality || "Common");

  if (QUALITIES[normalized]) {
    return normalized;
  }

  return "Common";
}

function getQualityData(quality = "Common") {
  const normalizedQuality = normalizeQuality(quality);

  return QUALITIES[normalizedQuality] || QUALITIES.Common;
}

function getQualityEmoji(quality = "Common") {
  return getQualityData(quality).emoji || "🟢";
}

function getQualityColor(quality = "Common") {
  return getQualityData(quality).color || "#22C55E";
}

function getQualityStatMultiplier(quality = "Common") {
  return Number(getQualityData(quality).statMultiplier || 1);
}

function getQualityPriceMultiplier(quality = "Common") {
  return Number(getQualityData(quality).priceMultiplier || 1);
}

function formatItemName(item = {}) {
  const quality = normalizeQuality(item.quality || "Common");
  const emoji = getQualityEmoji(quality);
  const name = item.name || "Unknown Item";

  return `${emoji} ${name}`;
}

module.exports = {
  QUALITIES,
  normalizeQuality,
  getQualityData,
  getQualityEmoji,
  getQualityColor,
  getQualityStatMultiplier,
  getQualityPriceMultiplier,
  formatItemName,
};