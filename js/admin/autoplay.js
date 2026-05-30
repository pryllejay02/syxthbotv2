const huntCommand = require("../commands/hunt");
const hitCommand = require("../commands/hit");

const { isCreator } = require("../utils/adminUtils");
const { db } = require("../../firebase/firebase");
const { resolvePlayerRevive } = require("../utils/reviveSystem");

const autoPlayers = new Map();

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
    return message.reply(
      autoPlayers.has(userId)
        ? "✅ Auto Hunt: ON"
        : "❌ Auto Hunt: OFF"
    );
  }

  if (action === "off") {
    const timer = autoPlayers.get(userId);

    if (timer) {
      clearInterval(timer.interval);
      autoPlayers.delete(userId);
    }

    return message.reply("🛑 Auto Hunt OFF");
  }

  if (autoPlayers.has(userId)) {
    return message.reply("⚠️ Already active.");
  }

  const playerRef = db.collection("players").doc(userId);
  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply("❌ You don’t have a character yet. Use `!s start` first.");
  }

  const player = playerDoc.data();

  // Optional safety: Auto Hunt should run only inside your private MMORPG room.
  if (player.privateChannelId && message.channel.id !== player.privateChannelId) {
    return message.reply(
      `❌ Please start Auto Hunt inside your private room: <#${player.privateChannelId}>`
    );
  }

  await message.reply("🤖 Auto Hunt ON");

  const state = {
    running: false,
  };

  const interval = setInterval(async () => {
    if (state.running) return;

    state.running = true;

    try {
      const latestPlayerDoc = await playerRef.get();

      if (!latestPlayerDoc.exists) {
        clearInterval(interval);
        autoPlayers.delete(userId);
        return;
      }

      let latestPlayer = latestPlayerDoc.data();

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

        await new Promise((resolve) =>
          setTimeout(resolve, 500)
        );
      }

      const latestBattleDoc = await battleRef.get();

      if (latestBattleDoc.exists) {
        await hitCommand(message);
      }
    } catch (error) {
      console.error("AUTO ERROR:", error);
    } finally {
      state.running = false;
    }
  }, 2500);

  autoPlayers.set(userId, {
    interval,
  });
};