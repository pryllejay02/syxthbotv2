const huntCommand = require("../commands/hunt");
const hitCommand = require("../commands/hit");

const { isCreator } = require("../utils/adminUtils");
const { db } = require("../../firebase/firebase");
const { resolvePlayerRevive } = require("../utils/reviveSystem");
const balanceConfig = require("../data/balanceConfig");

const autoPlayers = new Map();

const INVENTORY_FIELDS = ["inventory", "items", "backpack"];
const HP_POTION_ID = "hp_potion";

function getAutoHuntIntervalMs() {
  const envInterval = Number(process.env.AUTO_HUNT_INTERVAL_MS || 0);
  const fallbackInterval = Number(balanceConfig.commandCooldowns?.hunt || 3000);

  return Math.max(2500, envInterval || fallbackInterval);
}

function getAutoPotionHpPercent() {
  const envPercent = Number(process.env.AUTO_HUNT_POTION_HP_PERCENT || 0);

  if (Number.isFinite(envPercent) && envPercent > 0) {
    return Math.min(90, Math.max(5, envPercent));
  }

  return 35;
}

function stopAutoHunt(userId) {
  const timer = autoPlayers.get(userId);

  if (!timer) return false;

  clearInterval(timer.interval);
  autoPlayers.delete(userId);

  return true;
}

async function getLatestPlayer(playerRef) {
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return {
      exists: false,
      player: null,
    };
  }

  return {
    exists: true,
    player: playerDoc.data(),
  };
}

function normalizeId(value) {
  return String(value || "").toLowerCase().trim();
}

function isHpPotion(item = {}) {
  const possibleIds = [
    item.id,
    item.baseItemId,
    item.itemId,
    item.uid,
    item.name,
  ].map(normalizeId);

  return possibleIds.includes(HP_POTION_ID);
}

function getInventoryField(player = {}) {
  for (const field of INVENTORY_FIELDS) {
    const value = player[field];

    if (Array.isArray(value)) return field;

    if (value && typeof value === "object") return field;
  }

  return "inventory";
}

function getPotionHealAmount(potion = {}, maxHp = 100) {
  const directHeal = Number(
    potion.healAmount ||
      potion.heal ||
      potion.hpRestore ||
      potion.restoreHp ||
      0
  );

  if (Number.isFinite(directHeal) && directHeal > 0) {
    return directHeal;
  }

  const healPercent = Number(
    potion.healPercent ||
      potion.hpPercent ||
      potion.restorePercent ||
      0
  );

  if (Number.isFinite(healPercent) && healPercent > 0) {
    return Math.ceil(maxHp * (healPercent / 100));
  }

  return maxHp;
}

function consumePotionFromArrayInventory(inventory = [], maxHp = 100) {
  const nextInventory = [...inventory];

  const potionIndex = nextInventory.findIndex((item) => {
    return isHpPotion(item) && Number(item?.quantity || 1) > 0;
  });

  if (potionIndex === -1) {
    return {
      used: false,
      inventory: nextInventory,
      healAmount: 0,
    };
  }

  const potion = nextInventory[potionIndex] || {};
  const quantity = Number(potion.quantity || 1);
  const healAmount = getPotionHealAmount(potion, maxHp);

  if (quantity > 1) {
    nextInventory[potionIndex] = {
      ...potion,
      quantity: quantity - 1,
    };
  } else {
    nextInventory.splice(potionIndex, 1);
  }

  return {
    used: true,
    inventory: nextInventory,
    healAmount,
  };
}

function consumePotionFromObjectInventory(inventory = {}, maxHp = 100) {
  const nextInventory = {
    ...inventory,
  };

  const potionKey = Object.keys(nextInventory).find((key) => {
    const item = nextInventory[key];

    if (normalizeId(key) === HP_POTION_ID) {
      return Number(item?.quantity || 1) > 0;
    }

    return isHpPotion(item) && Number(item?.quantity || 1) > 0;
  });

  if (!potionKey) {
    return {
      used: false,
      inventory: nextInventory,
      healAmount: 0,
    };
  }

  const potion = nextInventory[potionKey] || {};
  const quantity = Number(potion.quantity || 1);
  const healAmount = getPotionHealAmount(potion, maxHp);

  if (quantity > 1) {
    nextInventory[potionKey] = {
      ...potion,
      quantity: quantity - 1,
    };
  } else {
    delete nextInventory[potionKey];
  }

  return {
    used: true,
    inventory: nextInventory,
    healAmount,
  };
}

async function autoUseHpPotionIfNeeded(playerRef) {
  const thresholdPercent = getAutoPotionHpPercent();

  return db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);

    if (!playerDoc.exists) {
      return {
        used: false,
        reason: "player_not_found",
        player: null,
      };
    }

    const player = playerDoc.data() || {};

    const currentHp = Number(player.hp || 0);
    const maxHp = Math.max(1, Number(player.maxHp || 100));
    const hpPercent = (currentHp / maxHp) * 100;

    if (currentHp <= 0) {
      return {
        used: false,
        reason: "dead",
        player,
      };
    }

    if (hpPercent > thresholdPercent) {
      return {
        used: false,
        reason: "hp_safe",
        player,
      };
    }

    const inventoryField = getInventoryField(player);
    const inventory = player[inventoryField];

    const consumeResult = Array.isArray(inventory)
      ? consumePotionFromArrayInventory(inventory, maxHp)
      : consumePotionFromObjectInventory(inventory || {}, maxHp);

    if (!consumeResult.used) {
      return {
        used: false,
        reason: "no_potion",
        player,
      };
    }

    const nextHp = Math.min(
      maxHp,
      currentHp + Number(consumeResult.healAmount || maxHp)
    );

    const nextPlayer = {
      ...player,
      [inventoryField]: consumeResult.inventory,
      hp: nextHp,
      updatedAt: new Date(),
    };

    transaction.update(playerRef, {
      [inventoryField]: consumeResult.inventory,
      hp: nextHp,
      updatedAt: new Date(),
    });

    return {
      used: true,
      reason: "used",
      player: nextPlayer,
      currentHp,
      nextHp,
      maxHp,
      healAmount: consumeResult.healAmount,
      thresholdPercent,
    };
  });
}

module.exports = async function autoplay(message, args = []) {
  // Auto Hunt is controlled by .env
  // Works in production only if AUTO_HUNT_ENABLED=true
  if (process.env.AUTO_HUNT_ENABLED !== "true") {
    return message.reply("❌ Auto Hunt is disabled.");
  }

  if (!isCreator(message.member)) {
    return message.reply("❌ Creator only.");
  }

  const action = String(args[0] || "").toLowerCase();
  const userId = message.author.id;

  if (!["on", "off", "status"].includes(action)) {
    return message.reply(
      `❌ Usage:\n\n` +
        `!s creator on\n` +
        `!s creator off\n` +
        `!s creator status`
    );
  }

  if (action === "status") {
    const timer = autoPlayers.get(userId);

    if (!timer) {
      return message.reply("❌ Auto Hunt: OFF");
    }

    return message.reply(
      `✅ Auto Hunt: ON\n\n` +
        `📍 Channel: <#${timer.channelId}>\n` +
        `⏱️ Interval: **${timer.intervalMs}ms**\n` +
        `🧪 Auto Potion: **${timer.potionThresholdPercent}% HP or lower**`
    );
  }

  if (action === "off") {
    const stopped = stopAutoHunt(userId);

    return message.reply(
      stopped ? "🛑 Auto Hunt OFF" : "ℹ️ Auto Hunt is already OFF."
    );
  }

  if (autoPlayers.has(userId)) {
    return message.reply("⚠️ Auto Hunt is already active.");
  }

  const playerRef = db.collection("players").doc(userId);
  const playerResult = await getLatestPlayer(playerRef);

  if (!playerResult.exists) {
    return message.reply("❌ You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerResult.player;

  // Safety: Auto Hunt should run only inside your private MMORPG room.
  if (player.privateChannelId && message.channel.id !== player.privateChannelId) {
    return message.reply(
      `❌ Please start Auto Hunt inside your private room: <#${player.privateChannelId}>`
    );
  }

  const intervalMs = getAutoHuntIntervalMs();
  const potionThresholdPercent = getAutoPotionHpPercent();

  await message.reply(
    `🤖 Auto Hunt ON\n\n` +
      `⏱️ Interval: **${intervalMs}ms**\n` +
      `🧪 Auto Potion: Uses \`${HP_POTION_ID}\` at **${potionThresholdPercent}% HP or lower**\n` +
      `🛑 Stop: \`!s creator off\``
  );

  const state = {
    running: false,
  };

  const interval = setInterval(async () => {
    if (state.running) return;

    state.running = true;

    try {
      const latestPlayerResult = await getLatestPlayer(playerRef);

      if (!latestPlayerResult.exists) {
        stopAutoHunt(userId);

        await message.channel
          .send("🛑 Auto Hunt stopped because your character data was not found.")
          .catch(() => null);

        return;
      }

      let latestPlayer = latestPlayerResult.player;

      if (
        latestPlayer.privateChannelId &&
        message.channel.id !== latestPlayer.privateChannelId
      ) {
        stopAutoHunt(userId);

        await message.channel
          .send(
            `🛑 Auto Hunt stopped.\n\n` +
              `Reason: Private room changed or this is no longer your MMORPG room.`
          )
          .catch(() => null);

        return;
      }

      // Auto Hunt bypasses commandHandler,
      // so revive recovery must also happen here.
      const reviveResult = await resolvePlayerRevive(playerRef, latestPlayer);
      latestPlayer = reviveResult.player;

      if (reviveResult.revived) {
        await message.channel
          .send(
            `✨ Auto Hunt revive detected.\n` +
              `❤️ HP Restored: **${reviveResult.revivedHp}/${latestPlayer.maxHp || 100}**`
          )
          .catch(() => null);
      }

      if (Number(latestPlayer.hp || 0) <= 0) {
        return;
      }

      const potionResult = await autoUseHpPotionIfNeeded(playerRef);

      if (potionResult.used) {
        latestPlayer = potionResult.player;

        await message.channel
          .send(
            `🧪 Auto HP Potion used.\n` +
              `❤️ HP: **${potionResult.currentHp} → ${potionResult.nextHp}/${potionResult.maxHp}**`
          )
          .catch(() => null);

        return;
      }

      const battleRef = db.collection("battles").doc(userId);
      const battleDoc = await battleRef.get();

      if (!battleDoc.exists) {
        await huntCommand(message);

        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      }

      const latestBattleDoc = await battleRef.get();

      if (latestBattleDoc.exists) {
        await hitCommand(message);
      }
    } catch (error) {
      console.error("AUTO HUNT ERROR:", error);
    } finally {
      state.running = false;
    }
  }, intervalMs);

  interval.unref?.();

  autoPlayers.set(userId, {
    interval,
    intervalMs,
    channelId: message.channel.id,
    potionThresholdPercent,
    startedAt: new Date(),
  });

  return null;
};