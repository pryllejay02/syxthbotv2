const { db } = require("../../firebase/firebase");
const partyConfig = require("../data/partyConfig");

function getWorldPartyConfig(worldId) {
  return partyConfig.worlds[worldId] || null;
}

function getMentions(message) {
  return [...message.mentions.users.values()].filter((user) => !user.bot);
}

async function getPlayer(userId) {
  const playerDoc = await db.collection("players").doc(userId).get();
  if (!playerDoc.exists) return null;
  return playerDoc.data();
}

async function findUserActiveParty(userId) {
  const snapshot = await db
    .collection("parties")
    .where("status", "in", ["forming", "ready", "raiding"])
    .get();

  for (const doc of snapshot.docs) {
    const party = doc.data();
    const members = party.members || [];
    const invited = party.invited || [];

    if (
      party.leaderId === userId ||
      members.includes(userId) ||
      invited.includes(userId)
    ) {
      return {
        id: doc.id,
        ...party,
      };
    }
  }

  return null;
}

async function filterSameWorldInvites(inviteIds, leaderWorldId) {
  const validInvites = [];
  const invalidInvites = [];

  for (const invitedUserId of inviteIds) {
    const invitedPlayer = await getPlayer(invitedUserId);

    if (!invitedPlayer) {
      invalidInvites.push({
        userId: invitedUserId,
        reason: "No character",
      });
      continue;
    }

    if (invitedPlayer.world?.id !== leaderWorldId) {
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

module.exports = {
  getWorldPartyConfig,
  getMentions,
  getPlayer,
  findUserActiveParty,
  filterSameWorldInvites,
};