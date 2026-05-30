const cooldowns = new Map();

function getKey(userId, action) {
  return `${userId}:${action}`;
}

function formatCooldown(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

function checkCooldown(userId, action, cooldownMs) {
  if (!cooldownMs || cooldownMs <= 0) {
    return {
      allowed: true,
      remainingMs: 0,
    };
  }

  const key = getKey(userId, action);
  const now = Date.now();
  const availableAt = cooldowns.get(key) || 0;

  if (now < availableAt) {
    return {
      allowed: false,
      remainingMs: availableAt - now,
    };
  }

  cooldowns.set(key, now + cooldownMs);

  // Small cleanup to avoid the map growing forever.
  setTimeout(() => {
    if ((cooldowns.get(key) || 0) <= Date.now()) {
      cooldowns.delete(key);
    }
  }, cooldownMs + 1000).unref?.();

  return {
    allowed: true,
    remainingMs: 0,
  };
}

function clearCooldown(userId, action) {
  cooldowns.delete(getKey(userId, action));
}

module.exports = {
  checkCooldown,
  clearCooldown,
  formatCooldown,
};
