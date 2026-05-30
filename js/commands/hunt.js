const { AttachmentBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const monsters = require("../data/monsters");

function getRandomMonster(playerLevel) {
  const level = Number(playerLevel || 1);

  // New players should learn safely first.
  if (level <= 3) {
    const levelOneMonsters = monsters.filter(
      (monster) => Number(monster.level) === 1
    );

    if (levelOneMonsters.length > 0) {
      return levelOneMonsters[
        Math.floor(Math.random() * levelOneMonsters.length)
      ];
    }

    return monsters[0];
  }

  // Prevent high-level players from fighting very low-level monsters too often.
  const minLevel = Math.max(1, level - 5);
  const maxLevel = level + 3;

  const possibleMonsters = monsters.filter((monster) => {
    const monsterLevel = Number(monster.level || 1);
    return monsterLevel >= minLevel && monsterLevel <= maxLevel;
  });

  if (possibleMonsters.length === 0) {
    return monsters[0];
  }

  return possibleMonsters[
    Math.floor(Math.random() * possibleMonsters.length)
  ];
}

module.exports = async function huntCommand(message) {
  const userId = message.author.id;

  const playerRef = db.collection("players").doc(userId);
  const battleRef = db.collection("battles").doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    const battleDoc = await transaction.get(battleRef);

    if (!playerDoc.exists) {
      return {
        ok: false,
        message: "You don’t have a character yet. Use `!s start` first.",
      };
    }

    if (battleDoc.exists) {
      const battle = battleDoc.data();

      return {
        ok: false,
        message:
          `⚔️ You are already fighting **${battle.monsterName}**!\n\n` +
          `❤️ Monster HP: ${battle.monsterHp}/${battle.monsterMaxHp}\n` +
          `Use \`!s hit\` or \`!s retreat\`.`,
      };
    }

    const player = playerDoc.data();

    if (Number(player.hp || 0) <= 0) {
      return {
        ok: false,
        message: "💀 You are defeated. Use `!s rest` before hunting again.",
      };
    }

    const monster = getRandomMonster(Number(player.level || 1));

    const monsterDodge = Number(monster.dodge || 0);
    const monsterCrit = Number(monster.crit || 0);

    const battleData = {
      userId,

      monsterName: monster.name,
      monsterLevel: monster.level,

      monsterHp: monster.hp,
      monsterMaxHp: monster.hp,

      monsterAttack: monster.attack,
      monsterDefense: monster.defense,

      monsterCrit,
      monsterDodge,

      monsterExp: monster.exp,
      monsterGold: monster.gold,

      createdAt: new Date(),
    };

    transaction.set(battleRef, battleData);

    return {
      ok: true,
      monster,
      monsterDodge,
      monsterCrit,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Hunt failed.");
  }

  const { monster, monsterDodge, monsterCrit } = result;

  const content =
    `🌑 A wild **${monster.name}** appeared!\n\n` +
    `👹 Monster Lv.${monster.level}\n` +
    `❤️ HP: ${monster.hp}/${monster.hp}\n` +
    `⚔️ Attack: ${monster.attack}\n` +
    `🛡️ Defense: ${monster.defense}\n` +
    `💨 Dodge: ${monsterDodge}%\n` +
    `💥 Crit: ${monsterCrit}%\n\n` +
    `Use \`!s hit\` to attack or \`!s retreat\` to escape.`;

  if (monster.image) {
    const monsterImage = new AttachmentBuilder(monster.image);

    return message.reply({
      content,
      files: [monsterImage],
    });
  }

  return message.reply(content);
};