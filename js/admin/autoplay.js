const huntCommand = require("../commands/hunt");
const hitCommand = require("../commands/hit");

const { isCreator } = require("../utils/adminUtils");
const { db } = require("../../firebase/firebase");

const autoPlayers = new Map();

module.exports = async function autoplay(message, args = []) {
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

  await message.reply("🤖 Auto Hunt ON");

  const state = {
    running: false,
  };

  const interval = setInterval(async () => {
    if (state.running) return;

    state.running = true;

    try {
      const playerDoc = await db
        .collection("players")
        .doc(userId)
        .get();

      if (!playerDoc.exists) {
        clearInterval(interval);
        autoPlayers.delete(userId);
        return;
      }

      const player = playerDoc.data();

      if (Number(player.hp || 0) <= 0) {
        return;
      }

      const battleDoc = await db
        .collection("battles")
        .doc(userId)
        .get();

      if (!battleDoc.exists) {
        await huntCommand(message);

        await new Promise((resolve) =>
          setTimeout(resolve, 500)
        );
      }

      const latestBattleDoc = await db
        .collection("battles")
        .doc(userId)
        .get();

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