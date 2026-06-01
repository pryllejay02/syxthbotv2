const balanceConfig = require("../data/balanceConfig");

const QUALITIES = balanceConfig.quality;

function getQualityData(quality = "Common") {
  return QUALITIES[quality] || QUALITIES.Common;
}

function getQualityEmoji(quality = "Common") {
  return getQualityData(quality).emoji;
}

function getQualityColor(quality = "Common") {
  return getQualityData(quality).color;
}

function getQualityStatMultiplier(quality = "Common") {
  return getQualityData(quality).statMultiplier || 1;
}

function getQualityPriceMultiplier(quality = "Common") {
  return getQualityData(quality).priceMultiplier || 1;
}

function formatItemName(item) {
  return `${getQualityEmoji(item.quality)} ${item.name}`;
}

module.exports = {
  QUALITIES,
  getQualityData,
  getQualityEmoji,
  getQualityColor,
  getQualityStatMultiplier,
  getQualityPriceMultiplier,
  formatItemName,
};