const path = require("path");

function getFallbackMonsterStats(level) {
  const lv = Number(level || 1);

  return {
    hp: Math.floor(25 + lv * 25 + lv * lv * 0.35),
    attack: Math.floor(4 + lv * 4.2 + lv * lv * 0.03),
    defense: Math.floor(1 + lv * 2.2 + lv * lv * 0.018),
    dodge: Math.min(25, Number((1 + lv * 0.18).toFixed(1))),
    crit: Math.min(30, Number((2 + lv * 0.25).toFixed(1))),
  };
}

function getFallbackMonsterReward(level) {
  const lv = Number(level || 1);

  return {
    exp: Math.floor(35 + lv * 12 + lv * lv * 0.65),
    gold: Math.floor(25 + lv * 7 + lv * lv * 0.28),
  };
}

function monster({
  id,
  name,
  level,
  hp,
  attack,
  defense,
  dodge,
  crit,
  exp,
  gold,
  image,

  // Keep false by default so balanceConfig controls monster scaling.
  // Set true only for special monsters with custom/manual stats.
  statOverride = false,
  rewardOverride = false,
}) {
  const monsterLevel = Number(level || 1);
  const fallbackStats = getFallbackMonsterStats(monsterLevel);
  const fallbackReward = getFallbackMonsterReward(monsterLevel);

  return {
    id,
    name,
    level: monsterLevel,

    // These are safe fallback values.
    // If hunt.js uses balanceConfig.getBalancedMonsterStats(),
    // these values are ignored unless statOverride is true.
    hp: Number(hp ?? fallbackStats.hp),
    attack: Number(attack ?? fallbackStats.attack),
    defense: Number(defense ?? fallbackStats.defense),
    dodge: Number(dodge ?? fallbackStats.dodge),
    crit: Number(crit ?? fallbackStats.crit),

    // These are safe fallback rewards.
    // If hunt.js uses balanceConfig.getMonsterReward(),
    // these values are ignored unless rewardOverride is true.
    exp: Number(exp ?? fallbackReward.exp),
    gold: Number(gold ?? fallbackReward.gold),

    statOverride,
    rewardOverride,

    image: image
      ? path.join(__dirname, "../../img/monsters_img", image)
      : null,
  };
}

const monsters = [
  monster({
    id: "slime",
    name: "Slime",
    level: 1,
    image: "slime.png",
  }),

  monster({
    id: "goblin",
    name: "Goblin",
    level: 5,
    image: "goblin.png",
  }),

  monster({
    id: "wolf",
    name: "Wolf",
    level: 10,
    image: "wolf.png",
  }),

  monster({
    id: "skeleton_soldier",
    name: "Skeleton Soldier",
    level: 15,
    image: "skeleton_soldier.png",
  }),

  monster({
    id: "orc_warrior",
    name: "Orc Warrior",
    level: 20,
    image: "orc_warrior.png",
  }),

  monster({
    id: "cursed_spider",
    name: "Cursed Spider",
    level: 25,
    image: "cursed_spider.png",
  }),

  monster({
    id: "lava_golem",
    name: "Lava Golem",
    level: 30,
    image: "lava_golem.png",
  }),

  monster({
    id: "shadow_assassin",
    name: "Shadow Assassin",
    level: 35,
    image: "shadow_assassin.png",
  }),

  monster({
    id: "dark_knight",
    name: "Dark Knight",
    level: 40,
    image: "dark_knight.png",
  }),

  monster({
    id: "crystal_beast",
    name: "Crystal Beast",
    level: 45,
    image: "crystal_beast.png",
  }),

  monster({
    id: "hell_guardian",
    name: "Hell Guardian",
    level: 50,
    image: "hell_guardian.png",
  }),

  monster({
    id: "phantom_reaper",
    name: "Phantom Reaper",
    level: 55,
    image: "phantom_reaper.png",
  }),

  monster({
    id: "ancient_minotaur",
    name: "Ancient Minotaur",
    level: 60,
    image: "ancient_minotaur.png",
  }),

  monster({
    id: "void_demon",
    name: "Void Demon",
    level: 65,
    image: "void_demon.png",
  }),

  monster({
    id: "celestial_beast",
    name: "Celestial Beast",
    level: 70,
    image: "celestial_beast.png",
  }),

  monster({
    id: "ancient_dragon",
    name: "Ancient Dragon",
    level: 75,
    image: "ancient_dragon.png",
  }),

  monster({
    id: "chaos_titan",
    name: "Chaos Titan",
    level: 80,
    image: "chaos_titan.png",
  }),

  monster({
    id: "demon_emperor",
    name: "Demon Emperor",
    level: 85,
    image: "demon_emperor.png",
  }),

  monster({
    id: "world_devourer",
    name: "World Devourer",
    level: 90,
    image: "world_devourer.png",
  }),
];

module.exports = monsters;