const { db } = require("../../firebase/firebase");

module.exports = async function retreatCommand(message) {
  const userId = message.author.id;
  const battleRef = db.collection("battles").doc(userId);

  const battleDoc = await battleRef.get();

  if (!battleDoc.exists) {
    return message.reply("You are not in battle.");
  }

  await battleRef.delete();

  return message.reply("🏃 You retreated from the battle.");
};