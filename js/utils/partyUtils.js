const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");

const ACTIVE_PARTY_STATUSES = ["forming", "ready", "raiding"];

function getWorldPartyConfig(worldId) {
  if (!worldId) return null;

  return partyConfig.worlds[worldId] || null;
}

function getMentions(message) {
  return [...message.mentions.users.values()]
    .filter((user) => !user.bot)
    .filter(
      (user, index, array) =>
        array.findIndex((item) => item.id === user.id) === index
    );
}

async function getPlayer(userId) {
  if (!userId) return null;

  const playerDoc = await db.collection("players").doc(userId).get();

  if (!playerDoc.exists) return null;

  return {
    id: playerDoc.id,
    ...playerDoc.data(),
  };
}

async function getPlayers(userIds = []) {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);

  const results = {};

  await Promise.all(
    uniqueIds.map(async (userId) => {
      const player = await getPlayer(userId);

      if (player) {
        results[userId] = player;
      }
    })
  );

  return results;
}

function isUserInParty(party, userId) {
  const members = party.members || [];
  const invited = party.invited || [];

  return (
    party.leaderId === userId ||
    members.includes(userId) ||
    invited.includes(userId)
  );
}

async function findUserActiveParty(userId) {
  if (!userId) return null;

  const snapshot = await db
    .collection("parties")
    .where("status", "in", ACTIVE_PARTY_STATUSES)
    .get();

  for (const doc of snapshot.docs) {
    const party = doc.data();

    if (isUserInParty(party, userId)) {
      return {
        id: doc.id,
        ...party,
      };
    }
  }

  return null;
}

async function findUsersWithActiveParties(userIds = []) {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);

  const busy = [];
  const free = [];

  for (const userId of uniqueIds) {
    const activeParty = await findUserActiveParty(userId);

    if (activeParty) {
      busy.push(userId);
    } else {
      free.push(userId);
    }
  }

  return {
    busy,
    free,
  };
}

async function filterSameWorldInvites(inviteIds, leaderWorldId) {
  const uniqueInviteIds = [...new Set(inviteIds)].filter(Boolean);

  const validInvites = [];
  const invalidInvites = [];

  const players = await getPlayers(uniqueInviteIds);

  for (const invitedUserId of uniqueInviteIds) {
    const invitedPlayer = players[invitedUserId];

    if (!invitedPlayer) {
      invalidInvites.push({
        userId: invitedUserId,
        reason: "No character",
      });
      continue;
    }

    const invitedWorldId = invitedPlayer.world?.id;

    if (!invitedWorldId) {
      invalidInvites.push({
        userId: invitedUserId,
        reason: "No selected world",
      });
      continue;
    }

    if (invitedWorldId !== leaderWorldId) {
      invalidInvites.push({
        userId: invitedUserId,
        reason: "Different world",
      });
      continue;
    }

    validInvites.push(invitedUserId);
  }

  return {
    validInvites,
    invalidInvites,
  };
}

function formatInvalidInvites(invalidInvites = []) {
  if (!invalidInvites.length) return "";

  return invalidInvites
    .map((entry) => `• <@${entry.userId}> — ${entry.reason}`)
    .join("\n");
}

function formatPartyMembers(ids = []) {
  if (!ids.length) return "None";

  return ids.map((id) => `<@${id}>`).join(", ");
}

module.exports = {
  ACTIVE_PARTY_STATUSES,
  getWorldPartyConfig,
  getMentions,
  getPlayer,
  getPlayers,
  isUserInParty,
  findUserActiveParty,
  findUsersWithActiveParties,
  filterSameWorldInvites,
  formatInvalidInvites,
  formatPartyMembers,
};