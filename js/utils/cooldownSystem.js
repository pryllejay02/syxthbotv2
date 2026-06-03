const cooldowns = new Map();

function normalizeId(value, fallback = "unknown") {
  return String(value || fallback).trim();
}

function normalizeAction(action = "default") {
  return String(action || "default").toLowerCase().trim();
}

function getKey(userId, action) {
  return `${normalizeId(userId)}:${normalizeAction(action)}`;
}

function formatCooldown(ms) {
  const totalMs = Math.max(0, Number(ms || 0));

  if (totalMs <= 0) {
    return "0s";
  }

  const seconds = Math.ceil(totalMs / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function checkCooldown(userId, action, cooldownMs) {
  const duration = Math.max(0, Number(cooldownMs || 0));

  if (!userId || !action || duration <= 0) {
    return {
      allowed: true,
      remainingMs: 0,
      availableAt: Date.now(),
    };
  }

  const key = getKey(userId, action);
  const now = Date.now();
  const availableAt = Number(cooldowns.get(key) || 0);

  if (now < availableAt) {
    return {
      allowed: false,
      remainingMs: availableAt - now,
      availableAt,
    };
  }

  const nextAvailableAt = now + duration;

  cooldowns.set(key, nextAvailableAt);

  setTimeout(() => {
    const currentAvailableAt = Number(cooldowns.get(key) || 0);

    if (currentAvailableAt <= Date.now()) {
      cooldowns.delete(key);
    }
  }, duration + 1000).unref?.();

  return {
    allowed: true,
    remainingMs: 0,
    availableAt: nextAvailableAt,
  };
}

function getCooldown(userId, action) {
  if (!userId || !action) {
    return {
      active: false,
      remainingMs: 0,
      availableAt: Date.now(),
    };
  }

  const key = getKey(userId, action);
  const now = Date.now();
  const availableAt = Number(cooldowns.get(key) || 0);
  const remainingMs = Math.max(0, availableAt - now);

  return {
    active: remainingMs > 0,
    remainingMs,
    availableAt: remainingMs > 0 ? availableAt : now,
  };
}

function clearCooldown(userId, action) {
  if (!userId || !action) return false;

  return cooldowns.delete(getKey(userId, action));
}

function clearUserCooldowns(userId) {
  if (!userId) return 0;

  let cleared = 0;
  const prefix = `${normalizeId(userId)}:`;

  for (const key of cooldowns.keys()) {
    if (key.startsWith(prefix)) {
      cooldowns.delete(key);
      cleared++;
    }
  }

  return cleared;
}

module.exports = {
  checkCooldown,
  getCooldown,
  clearCooldown,
  clearUserCooldowns,
  formatCooldown,
};