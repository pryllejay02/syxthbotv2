const { AttachmentBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const monsters = require("../data/monsters");
const balanceConfig = require("../data/balanceConfig");

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

function getBalancedMonsterStats(monster = {}) {
  if (typeof balanceConfig.getBalancedMonsterStats === "function") {
    return balanceConfig.getBalancedMonsterStats(monster);
  }

  return {
    hp: Number(monster.hp || 1),
    attack: Number(monster.attack || 1),
    defense: Number(monster.defense || 0),
    dodge: Number(monster.dodge || 0),
    crit: Number(monster.crit || 0),
  };
}

function getMonsterReward(monster = {}) {
  if (typeof balanceConfig.getMonsterReward === "function") {
    return balanceConfig.getMonsterReward(monster);
  }

  return {
    exp: Number(monster.exp || 1),
    gold: Number(monster.gold || 0),
  };
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

    const balancedStats = getBalancedMonsterStats(monster);

    // Reward is saved here but hidden from the hunt message.
    // It will only be shown after the monster is defeated in hit.js.
    const reward = getMonsterReward(monster);

    const battleData = {
      userId,

      monsterName: monster.name,
      monsterLevel: Number(monster.level || 1),

      monsterHp: Number(balancedStats.hp || 1),
      monsterMaxHp: Number(balancedStats.hp || 1),

      monsterAttack: Number(balancedStats.attack || 1),
      monsterDefense: Number(balancedStats.defense || 0),

      monsterCrit: Number(balancedStats.crit || 0),
      monsterDodge: Number(balancedStats.dodge || 0),

      // Hidden reward data.
      monsterExp: Number(reward.exp || 1),
      monsterGold: Number(reward.gold || 0),

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    transaction.set(battleRef, battleData);

    return {
      ok: true,
      monster,
      battleData,
    };
  });

  if (!result.ok) {
    return message.reply(result.message || "❌ Hunt failed.");
  }

  const { monster, battleData } = result;

  const content =
    `🌑 A wild **${monster.name}** appeared!\n\n` +
    `👹 Monster Lv.${battleData.monsterLevel}\n` +
    `❤️ HP: ${battleData.monsterHp}/${battleData.monsterMaxHp}\n` +
    `⚔️ Attack: ${battleData.monsterAttack}\n` +
    `🛡️ Defense: ${battleData.monsterDefense}\n` +
    `💨 Dodge: ${battleData.monsterDodge}%\n` +
    `💥 Crit: ${battleData.monsterCrit}%\n\n` +
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