function getEnvValue(key, fallback) {
  return process.env[key] || fallback;
}

function getEnvNumber(key, fallback) {
  const value = Number(process.env[key]);

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

module.exports = {
  // Public channel where players flex/show items only
  tradeAreaChannelId: getEnvValue(
    "TRADE_AREA_CHANNEL_ID",
    "1508717329561686186"
  ),

  // Channel where players use: !s trade @player
  createTradeChannelId: getEnvValue(
    "CREATE_TRADE_CHANNEL_ID",
    "1508717119859200141"
  ),

  // Category where private trade rooms are created
  tradeCategoryId: getEnvValue(
    "TRADE_CATEGORY_ID",
    "1508716926900240384"
  ),

  // Trade invitation expiration time
  inviteExpireMs: getEnvNumber(
    "TRADE_INVITE_EXPIRE_MS",
    2 * 60 * 1000
  ),

  // Private trade room auto-delete delay after complete/cancel
  deleteChannelDelayMs: getEnvNumber(
    "TRADE_DELETE_CHANNEL_DELAY_MS",
    5 * 1000
  ),
};