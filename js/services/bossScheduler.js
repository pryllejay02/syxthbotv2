const bossConfig = require("../data/bossConfig");
const partyConfig = require("../data/partyConfig");
const { spawnBoss } = require("./bossService");

const TIMEZONE = "Asia/Manila";

let lastSpawnKey = null;

function getPHTimeParts() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);

  const values = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

async function runBossScheduler(client) {
  const { date, time } = getPHTimeParts();

  const schedule = bossConfig.spawnSchedule.find(
    (entry) => entry.time === time
  );

  if (!schedule) return;

  const spawnKey = `${date}-${time}-${schedule.tier}`;

  if (lastSpawnKey === spawnKey) return;

  lastSpawnKey = spawnKey;

  const worldIds = Object.keys(partyConfig.worlds);

  for (const worldId of worldIds) {
    await spawnBoss(client, worldId, schedule.tier);
  }

  console.log(
    `World boss spawned for all worlds at ${time} PHT. Tier: ${schedule.tier}`
  );
}

function startBossScheduler(client) {
  console.log("Boss scheduler started. Timezone: Asia/Manila");

  setInterval(async () => {
    try {
      await runBossScheduler(client);
    } catch (error) {
      console.error("Boss scheduler error:", error);
    }
  }, 30 * 1000);
}

module.exports = {
  startBossScheduler,
};