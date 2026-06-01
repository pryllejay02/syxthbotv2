const bossConfig = require("../data/bossConfig");
const partyConfig = require("../data/partyConfig");
const { spawnBoss } = require("./bossService");

const TIMEZONE = "Asia/Manila";
const SCHEDULER_INTERVAL_MS = Number(
  process.env.BOSS_SCHEDULER_INTERVAL_MS || 30 * 1000
);

let lastSpawnKey = null;
let schedulerInterval = null;

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

function getSpawnSchedule(time) {
  return (bossConfig.spawnSchedule || []).find(
    (entry) => String(entry.time || "") === time
  );
}

function getWorldIds() {
  return Object.keys(partyConfig.worlds || {});
}

async function spawnBossForWorld(client, worldId, tier) {
  try {
    await spawnBoss(client, worldId, tier);

    return {
      ok: true,
      worldId,
    };
  } catch (error) {
    console.error(`Boss spawn failed for ${worldId}:`, error);

    return {
      ok: false,
      worldId,
      error,
    };
  }
}

async function runBossScheduler(client) {
  if (!client) return;

  const { date, time } = getPHTimeParts();
  const schedule = getSpawnSchedule(time);

  if (!schedule) return;

  const tier = String(schedule.tier || "").toLowerCase();

  if (!tier) {
    console.warn(`Boss schedule found at ${time}, but tier is missing.`);
    return;
  }

  const spawnKey = `${date}-${time}-${tier}`;

  if (lastSpawnKey === spawnKey) return;

  lastSpawnKey = spawnKey;

  const worldIds = getWorldIds();

  if (worldIds.length === 0) {
    console.warn("Boss scheduler skipped: No worlds configured.");
    return;
  }

  const results = [];

  for (const worldId of worldIds) {
    const result = await spawnBossForWorld(client, worldId, tier);
    results.push(result);
  }

  const successCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - successCount;

  console.log(
    `World boss scheduler ran at ${time} PHT. Tier: ${tier}. ` +
      `Success: ${successCount}. Failed: ${failedCount}.`
  );
}

function startBossScheduler(client) {
  if (schedulerInterval) {
    console.log("Boss scheduler is already running.");
    return schedulerInterval;
  }

  console.log(
    `Boss scheduler started. Timezone: ${TIMEZONE}. Interval: ${SCHEDULER_INTERVAL_MS}ms`
  );

  schedulerInterval = setInterval(async () => {
    try {
      await runBossScheduler(client);
    } catch (error) {
      console.error("Boss scheduler error:", error);
    }
  }, SCHEDULER_INTERVAL_MS);

  schedulerInterval.unref?.();

  return schedulerInterval;
}

function stopBossScheduler() {
  if (!schedulerInterval) {
    return false;
  }

  clearInterval(schedulerInterval);
  schedulerInterval = null;

  console.log("Boss scheduler stopped.");

  return true;
}

module.exports = {
  startBossScheduler,
  stopBossScheduler,
  runBossScheduler,
};