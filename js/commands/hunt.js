const { db } = require("../../firebase/firebase");
const monsters = require("../data/monsters");

function getRandomMonster(playerLevel) {
  const possibleMonsters = monsters.filter(
    (monster) => monster.level <= playerLevel + 5
  );

  if (possibleMonsters.length === 0) {
    return monsters[0];
  }

  return possibleMonsters[Math.floor(Math.random() * possibleMonsters.length)];
}

module.exports = async function huntCommand(message) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);
  const battleRef = db.collection("battles").doc(userId);

  const playerDoc = await playerRef.get();
  const battleDoc = await battleRef.get();

  if (!playerDoc.exists) {
    return message.reply("You don’t have a character yet. Use `!s start` first.");
  }

  if (battleDoc.exists) {
    const battle = battleDoc.data();

    return message.reply(
      `⚔️ You are already fighting **${battle.monsterName}**!\n\n` +
      `Monster HP: ${battle.monsterHp}/${battle.monsterMaxHp}\n` +
      `Use \`!s hit\` or \`!s retreat\`.`
    );
  }

  const player = playerDoc.data();

  if (player.hp <= 0) {
    return message.reply("💀 You are defeated. Use `!s rest` before hunting again.");
  }

  const monster = getRandomMonster(player.level);

  await battleRef.set({
    userId: userId,
    monsterName: monster.name,
    monsterLevel: monster.level,
    monsterHp: monster.hp,
    monsterMaxHp: monster.hp,
    monsterAttack: monster.attack,
    monsterDefense: monster.defense,
    monsterExp: monster.exp,
    monsterGold: monster.gold,
    createdAt: new Date(),
  });

return message.reply({
  content:
    `🌑 A wild **${monster.name}** appeared!\n\n` +
    `Monster Level: ${monster.level}\n` +
    `Monster HP: ${monster.hp}/${monster.hp}\n` +
    `Monster Attack: ${monster.attack}\n` +
    `Monster Defense: ${monster.defense}\n\n` +
    `Use \`!s hit\` to attack or \`!s retreat\` to escape.`,
    
  files: [monster.image],
});

};