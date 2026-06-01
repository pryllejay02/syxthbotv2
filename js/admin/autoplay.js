const huntCommand = require("../commands/hunt");
const hitCommand = require("../commands/hit");

const { isCreator } = require("../utils/adminUtils");
const { db } = require("../../firebase/firebase");
const { resolvePlayerRevive } = require("../utils/reviveSystem");
const balanceConfig = require("../data/balanceConfig");

const autoPlayers = new Map();

function getAutoHuntIntervalMs() {
  const envInterval = Number(process.env.AUTO_HUNT_INTERVAL_MS || 0);
  const fallbackInterval = Number(balanceConfig.commandCooldowns?.hunt || 3000);

  return Math.max(2500, envInterval || fallbackInterval);
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
        `⏱️ Interval: **${timer.intervalMs}ms**`
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

  await message.reply(
    `🤖 Auto Hunt ON\n\n` +
      `⏱️ Interval: **${intervalMs}ms**\n` +
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
    startedAt: new Date(),
  });

  return null;
};