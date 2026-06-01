const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");

const ACTIVE_PARTY_STATUSES = ["forming", "ready", "raiding"];

function getWorldPartyConfig(worldId) {
  if (!worldId) return null;

  return partyConfig.worlds?.[worldId] || null;
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueIds(ids = []) {
  return [...new Set(ids.filter(Boolean))];
}

function getMentions(message) {
  if (!message?.mentions?.users) return [];

  return [...message.mentions.users.values()]
    .filter((user) => user && !user.bot)
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
  const uniqueUserIds = uniqueIds(userIds);
  const results = {};

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const player = await getPlayer(userId);

      if (player) {
        results[userId] = player;
      }
    })
  );

  return results;
}

function isActivePartyStatus(status) {
  return ACTIVE_PARTY_STATUSES.includes(status || "ready");
}

function isUserInParty(party = {}, userId) {
  if (!party || !userId) return false;

  const members = getArray(party.members);
  const invited = getArray(party.invited);

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
  const uniqueUserIds = uniqueIds(userIds);

  const busy = [];
  const free = [];

  for (const userId of uniqueUserIds) {
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

async function filterSameWorldInvites(inviteIds = [], leaderWorldId) {
  const uniqueInviteIds = uniqueIds(inviteIds);

  const validInvites = [];
  const invalidInvites = [];

  if (!leaderWorldId) {
    return {
      validInvites,
      invalidInvites: uniqueInviteIds.map((userId) => ({
        userId,
        reason: "Leader has no selected world",
      })),
    };
  }

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
  const uniqueMemberIds = uniqueIds(ids);

  if (!uniqueMemberIds.length) return "None";

  return uniqueMemberIds.map((id) => `<@${id}>`).join(", ");
}

function getPartyMemberCount(party = {}) {
  return getArray(party.members).length;
}

function getPartyInviteCount(party = {}) {
  return getArray(party.invited).length;
}

function getPartyTotalCount(party = {}) {
  return getPartyMemberCount(party) + getPartyInviteCount(party);
}

function getPartyMaxMembers(party = {}) {
  return Number(party.maxMembers || partyConfig.maxMembers || 5);
}

function getRemainingPartySlots(party = {}) {
  const maxMembers = getPartyMaxMembers(party);
  const currentCount = getPartyTotalCount(party);

  return Math.max(0, maxMembers - currentCount);
}

module.exports = {
  ACTIVE_PARTY_STATUSES,
  getWorldPartyConfig,
  getArray,
  uniqueIds,
  getMentions,
  getPlayer,
  getPlayers,
  isActivePartyStatus,
  isUserInParty,
  findUserActiveParty,
  findUsersWithActiveParties,
  filterSameWorldInvites,
  formatInvalidInvites,
  formatPartyMembers,
  getPartyMemberCount,
  getPartyInviteCount,
  getPartyTotalCount,
  getPartyMaxMembers,
  getRemainingPartySlots,
};