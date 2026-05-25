const { db } = require("../../firebase/firebase");

module.exports = async function voiceStateUpdate(oldState, newState) {
  try {
    const userId = oldState.member?.id || newState.member?.id;

    if (!userId) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (oldChannelId === newChannelId) return;

    const snapshot = await db
      .collection("parties")
      .where("status", "in", ["forming", "ready", "raiding"])
      .get();

    for (const doc of snapshot.docs) {
      const party = doc.data();

      if (!party.voiceChannelId) continue;
      if (oldChannelId !== party.voiceChannelId) continue;

      const members = party.members || [];

      if (!members.includes(userId)) continue;

      const channel =
        oldState.guild.channels.cache.get(
          party.voiceChannelId
        );

      // Leader left → remove entire party
      if (party.leaderId === userId) {
        if (channel) {
          await channel.delete().catch(() => null);
        }

        await db.collection("parties")
          .doc(doc.id)
          .delete();

        console.log(
          `Party ${doc.id} deleted because leader left`
        );

        continue;
      }

      // Remove normal member only
      const updatedMembers =
        members.filter(
          (id) => id !== userId
        );

      await db.collection("parties")
        .doc(doc.id)
        .update({
          members: updatedMembers,
        });

      if (channel) {
        await channel.permissionOverwrites
          .delete(userId)
          .catch(() => null);

        // Delete empty party
        if (updatedMembers.length === 0) {
          await channel.delete().catch(() => null);

          await db.collection("parties")
            .doc(doc.id)
            .delete();

          console.log(
            `Party ${doc.id} deleted because no members remain`
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "voiceStateUpdate party error:",
      error
    );
  }
};