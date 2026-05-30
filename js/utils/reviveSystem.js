function getReadyReviveField(player) {
  if (Number(player.hp || 0) > 0) return null;

  const now = Date.now();
  const reviveAvailableAt = Number(player.reviveAvailableAt || 0);
  const raidReviveAvailableAt = Number(player.raidReviveAvailableAt || 0);

  if (reviveAvailableAt && now >= reviveAvailableAt) {
    return "reviveAvailableAt";
  }

  if (raidReviveAvailableAt && now >= raidReviveAvailableAt) {
    return "raidReviveAvailableAt";
  }

  return null;
}

function getReviveRemainingSeconds(player) {
  if (Number(player.hp || 0) > 0) return 0;

  const now = Date.now();
  const timers = [
    Number(player.reviveAvailableAt || 0),
    Number(player.raidReviveAvailableAt || 0),
  ].filter(Boolean);

  if (!timers.length) return 0;

  const earliest = Math.min(...timers);
  return Math.max(0, Math.ceil((earliest - now) / 1000));
}

async function resolvePlayerRevive(playerRef, player) {
  const readyField = getReadyReviveField(player);

  if (!readyField) {
    return {
      player,
      revived: false,
      revivedHp: Number(player.hp || 0),
    };
  }

  const revivedHp = Math.floor(Number(player.maxHp || 100) * 0.5);

  const update = {
    hp: revivedHp,
    reviveAvailableAt: null,
    raidReviveAvailableAt: null,
  };

  await playerRef.update(update);

  return {
    player: {
      ...player,
      ...update,
    },
    revived: true,
    revivedHp,
  };
}

module.exports = {
  getReadyReviveField,
  getReviveRemainingSeconds,
  resolvePlayerRevive,
};
