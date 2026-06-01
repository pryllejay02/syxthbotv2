const balanceConfig = require("../data/balanceConfig");

function getTimeValue(value) {
  if (!value) return 0;

  if (typeof value === "number") {
    return value;
  }

  if (value.toMillis) {
    return value.toMillis();
  }

  if (value.toDate) {
    return value.toDate().getTime();
  }

  const parsedNumber = Number(value);

  if (!Number.isNaN(parsedNumber)) {
    return parsedNumber;
  }

  const parsedDate = new Date(value).getTime();

  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

function getReviveTimers(player = {}) {
  return {
    reviveAvailableAt: getTimeValue(player.reviveAvailableAt),
    raidReviveAvailableAt: getTimeValue(player.raidReviveAvailableAt),
  };
}

function getReadyReviveField(player = {}) {
  if (Number(player.hp || 0) > 0) {
    return null;
  }

  const now = Date.now();
  const timers = getReviveTimers(player);

  if (timers.reviveAvailableAt && now >= timers.reviveAvailableAt) {
    return "reviveAvailableAt";
  }

  if (timers.raidReviveAvailableAt && now >= timers.raidReviveAvailableAt) {
    return "raidReviveAvailableAt";
  }

  return null;
}

function getReviveRemainingSeconds(player = {}) {
  if (Number(player.hp || 0) > 0) {
    return 0;
  }

  const now = Date.now();
  const timers = getReviveTimers(player);

  const activeTimers = [
    timers.reviveAvailableAt,
    timers.raidReviveAvailableAt,
  ].filter((time) => time > 0);

  if (!activeTimers.length) {
    return Number(balanceConfig.revive?.normalSeconds || 60);
  }

  const earliest = Math.min(...activeTimers);

  return Math.max(0, Math.ceil((earliest - now) / 1000));
}

function getReviveTypeFromField(field) {
  if (field === "raidReviveAvailableAt") {
    return "raid";
  }

  return "normal";
}

function getReviveHp(maxHp, reviveType = "normal") {
  const revivePercent =
    reviveType === "raid"
      ? Number(balanceConfig.revive?.raidReviveHpPercent || 50)
      : Number(balanceConfig.revive?.freeReviveHpPercent || 50);

  return Math.max(
    1,
    Math.floor(Number(maxHp || 100) * (revivePercent / 100))
  );
}

async function resolvePlayerRevive(playerRef, player = {}) {
  const readyField = getReadyReviveField(player);

  if (!readyField) {
    return {
      player,
      revived: false,
      revivedHp: Number(player.hp || 0),
      reviveType: null,
    };
  }

  const reviveType = getReviveTypeFromField(readyField);
  const revivedHp = getReviveHp(player.maxHp, reviveType);

  const update = {
    hp: revivedHp,
    reviveAvailableAt: null,
    raidReviveAvailableAt: null,
    updatedAt: new Date(),
  };

  await playerRef.update(update);

  return {
    player: {
      ...player,
      ...update,
    },
    revived: true,
    revivedHp,
    reviveType,
  };
}

module.exports = {
  getTimeValue,
  getReviveTimers,
  getReadyReviveField,
  getReviveRemainingSeconds,
  getReviveTypeFromField,
  getReviveHp,
  resolvePlayerRevive,
};