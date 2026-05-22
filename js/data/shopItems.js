const shopItems = [
  // =========================
  // CONSUMABLES
  // =========================

  {
    id: "hp_potion",
    name: "HP Potion",
    type: "Consumable",
    quality: "Common",
    requiredLevel: 1,
    price: 100,
    description: "Restores 50% HP",
    healPercent: 50,
    emoji: "🧪",
  },

  // =========================
  // LEVEL 5 SET
  // =========================

  {
    id: "common_iron_sword",
    name: "Common Iron Sword",
    type: "Weapon",
    quality: "Common",
    requiredLevel: 5,
    price: 100,
    description: "+15 ATK",
    stats: {
      attack: 15,
      defense: 0,
      maxHp: 0,
    },
    emoji: "🗡️",
  },

  {
    id: "common_iron_helmet",
    name: "Common Iron Helmet",
    type: "Helmet",
    quality: "Common",
    requiredLevel: 5,
    price: 150,
    description: "+5 DEF, +25 HP",
    stats: {
      attack: 0,
      defense: 5,
      maxHp: 25,
    },
    emoji: "⛑️",
  },

  {
    id: "common_iron_armor",
    name: "Common Iron Armor",
    type: "Armor",
    quality: "Common",
    requiredLevel: 5,
    price: 200,
    description: "+10 DEF, +50 HP",
    stats: {
      attack: 0,
      defense: 10,
      maxHp: 50,
    },
    emoji: "🛡️",
  },

  {
    id: "common_iron_gloves",
    name: "Common Iron Gloves",
    type: "Gloves",
    quality: "Common",
    requiredLevel: 5,
    price: 200,
    description: "+3 ATK, +3 DEF, +10 HP",
    stats: {
      attack: 3,
      defense: 3,
      maxHp: 10,
    },
    emoji: "🧤",
  },

  {
    id: "common_iron_pants",
    name: "Common Iron Pants",
    type: "Pants",
    quality: "Common",
    requiredLevel: 5,
    price: 200,
    description: "+6 DEF, +30 HP",
    stats: {
      attack: 0,
      defense: 6,
      maxHp: 30,
    },
    emoji: "👖",
  },

  {
    id: "common_iron_boots",
    name: "Common Iron Boots",
    type: "Boots",
    quality: "Common",
    requiredLevel: 5,
    price: 200,
    description: "+4 DEF, +20 HP",
    stats: {
      attack: 0,
      defense: 4,
      maxHp: 20,
    },
    emoji: "🥾",
  },

  // =========================
  // LEVEL 10 SET
  // =========================

  {
    id: "common_steel_sword",
    name: "Common Steel Sword",
    type: "Weapon",
    quality: "Common",
    requiredLevel: 10,
    price: 250,
    description: "+30 ATK",
    stats: {
      attack: 30,
      defense: 0,
      maxHp: 0,
    },
    emoji: "🗡️",
  },

  {
    id: "common_steel_helmet",
    name: "Common Steel Helmet",
    type: "Helmet",
    quality: "Common",
    requiredLevel: 10,
    price: 300,
    description: "+10 DEF, +50 HP",
    stats: {
      attack: 0,
      defense: 10,
      maxHp: 50,
    },
    emoji: "⛑️",
  },

  {
    id: "common_steel_armor",
    name: "Common Steel Armor",
    type: "Armor",
    quality: "Common",
    requiredLevel: 10,
    price: 350,
    description: "+20 DEF, +100 HP",
    stats: {
      attack: 0,
      defense: 20,
      maxHp: 100,
    },
    emoji: "🛡️",
  },

  {
    id: "common_steel_gloves",
    name: "Common Steel Gloves",
    type: "Gloves",
    quality: "Common",
    requiredLevel: 10,
    price: 350,
    description: "+6 ATK, +6 DEF, +20 HP",
    stats: {
      attack: 6,
      defense: 6,
      maxHp: 20,
    },
    emoji: "🧤",
  },

  {
    id: "common_steel_pants",
    name: "Common Steel Pants",
    type: "Pants",
    quality: "Common",
    requiredLevel: 10,
    price: 350,
    description: "+12 DEF, +60 HP",
    stats: {
      attack: 0,
      defense: 12,
      maxHp: 60,
    },
    emoji: "👖",
  },

  {
    id: "common_steel_boots",
    name: "Common Steel Boots",
    type: "Boots",
    quality: "Common",
    requiredLevel: 10,
    price: 350,
    description: "+8 DEF, +40 HP",
    stats: {
      attack: 0,
      defense: 8,
      maxHp: 40,
    },
    emoji: "🥾",
  },

  // =========================
  // LEVEL 15 SET
  // =========================

  {
    id: "common_knight_sword",
    name: "Common Knight Sword",
    type: "Weapon",
    quality: "Common",
    requiredLevel: 15,
    price: 400,
    description: "+45 ATK",
    stats: {
      attack: 45,
      defense: 0,
      maxHp: 0,
    },
    emoji: "🗡️",
  },

  {
    id: "common_knight_helmet",
    name: "Common Knight Helmet",
    type: "Helmet",
    quality: "Common",
    requiredLevel: 15,
    price: 450,
    description: "+15 DEF, +80 HP",
    stats: {
      attack: 0,
      defense: 15,
      maxHp: 80,
    },
    emoji: "⛑️",
  },

  {
    id: "common_knight_armor",
    name: "Common Knight Armor",
    type: "Armor",
    quality: "Common",
    requiredLevel: 15,
    price: 500,
    description: "+30 DEF, +160 HP",
    stats: {
      attack: 0,
      defense: 30,
      maxHp: 160,
    },
    emoji: "🛡️",
  },

  {
    id: "common_knight_gloves",
    name: "Common Knight Gloves",
    type: "Gloves",
    quality: "Common",
    requiredLevel: 15,
    price: 500,
    description: "+10 ATK, +10 DEF, +35 HP",
    stats: {
      attack: 10,
      defense: 10,
      maxHp: 35,
    },
    emoji: "🧤",
  },

  {
    id: "common_knight_pants",
    name: "Common Knight Pants",
    type: "Pants",
    quality: "Common",
    requiredLevel: 15,
    price: 500,
    description: "+18 DEF, +90 HP",
    stats: {
      attack: 0,
      defense: 18,
      maxHp: 90,
    },
    emoji: "👖",
  },

  {
    id: "common_knight_boots",
    name: "Common Knight Boots",
    type: "Boots",
    quality: "Common",
    requiredLevel: 15,
    price: 500,
    description: "+12 DEF, +60 HP",
    stats: {
      attack: 0,
      defense: 12,
      maxHp: 60,
    },
    emoji: "🥾",
  },
  // =========================
// LEVEL 20 SET
// =========================
  {
  id: "common_silver_sword",
  name: "Common Silver Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 20,
  price: 550,
  description: "+60 ATK",
  stats: {
    attack: 60,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_silver_helmet",
  name: "Common Silver Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 20,
  price: 600,
  description: "+20 DEF, +100 HP",
  stats: {
    attack: 0,
    defense: 20,
    maxHp: 100,
  },
  emoji: "⛑️",
},

{
  id: "common_silver_armor",
  name: "Common Silver Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 20,
  price: 650,
  description: "+40 DEF, +200 HP",
  stats: {
    attack: 0,
    defense: 40,
    maxHp: 200,
  },
  emoji: "🛡️",
},

{
  id: "common_silver_gloves",
  name: "Common Silver Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 20,
  price: 650,
  description: "+15 ATK, +15 DEF, +50 HP",
  stats: {
    attack: 15,
    defense: 15,
    maxHp: 50,
  },
  emoji: "🧤",
},

{
  id: "common_silver_pants",
  name: "Common Silver Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 20,
  price: 650,
  description: "+24 DEF, +120 HP",
  stats: {
    attack: 0,
    defense: 24,
    maxHp: 120,
  },
  emoji: "👖",
},

{
  id: "common_silver_boots",
  name: "Common Silver Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 20,
  price: 650,
  description: "+18 DEF, +90 HP",
  stats: {
    attack: 0,
    defense: 18,
    maxHp: 90,
  },
  emoji: "🥾",
},

// =========================
// LEVEL 25 SET
// =========================

{
  id: "common_royal_sword",
  name: "Common Royal Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 25,
  price: 700,
  description: "+80 ATK",
  stats: {
    attack: 80,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_royal_helmet",
  name: "Common Royal Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 25,
  price: 750,
  description: "+28 DEF, +140 HP",
  stats: {
    attack: 0,
    defense: 28,
    maxHp: 140,
  },
  emoji: "⛑️",
},

{
  id: "common_royal_armor",
  name: "Common Royal Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 25,
  price: 800,
  description: "+55 DEF, +280 HP",
  stats: {
    attack: 0,
    defense: 55,
    maxHp: 280,
  },
  emoji: "🛡️",
},

{
  id: "common_royal_gloves",
  name: "Common Royal Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 25,
  price: 800,
  description: "+20 ATK, +20 DEF, +70 HP",
  stats: {
    attack: 20,
    defense: 20,
    maxHp: 70,
  },
  emoji: "🧤",
},

{
  id: "common_royal_pants",
  name: "Common Royal Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 25,
  price: 800,
  description: "+35 DEF, +180 HP",
  stats: {
    attack: 0,
    defense: 35,
    maxHp: 180,
  },
  emoji: "👖",
},

{
  id: "common_royal_boots",
  name: "Common Royal Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 25,
  price: 800,
  description: "+25 DEF, +120 HP",
  stats: {
    attack: 0,
    defense: 25,
    maxHp: 120,
  },
  emoji: "🥾",
},
// =========================
// LEVEL 30 SET
// =========================

{
  id: "common_guardian_sword",
  name: "Common Guardian Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 30,
  price: 850,
  description: "+105 ATK",
  stats: {
    attack: 105,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_guardian_helmet",
  name: "Common Guardian Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 30,
  price: 900,
  description: "+38 DEF, +190 HP",
  stats: {
    attack: 0,
    defense: 38,
    maxHp: 190,
  },
  emoji: "⛑️",
},

{
  id: "common_guardian_armor",
  name: "Common Guardian Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 30,
  price: 950,
  description: "+75 DEF, +380 HP",
  stats: {
    attack: 0,
    defense: 75,
    maxHp: 380,
  },
  emoji: "🛡️",
},

{
  id: "common_guardian_gloves",
  name: "Common Guardian Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 30,
  price: 950,
  description: "+28 ATK, +28 DEF, +90 HP",
  stats: {
    attack: 28,
    defense: 28,
    maxHp: 90,
  },
  emoji: "🧤",
},

{
  id: "common_guardian_pants",
  name: "Common Guardian Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 30,
  price: 950,
  description: "+48 DEF, +240 HP",
  stats: {
    attack: 0,
    defense: 48,
    maxHp: 240,
  },
  emoji: "👖",
},

{
  id: "common_guardian_boots",
  name: "Common Guardian Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 30,
  price: 950,
  description: "+34 DEF, +160 HP",
  stats: {
    attack: 0,
    defense: 34,
    maxHp: 160,
  },
  emoji: "🥾",
},

// =========================
// LEVEL 35 SET
// =========================

{
  id: "common_battle_sword",
  name: "Common Battle Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 35,
  price: 1000,
  description: "+130 ATK",
  stats: {
    attack: 130,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_battle_helmet",
  name: "Common Battle Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 35,
  price: 1050,
  description: "+50 DEF, +250 HP",
  stats: {
    attack: 0,
    defense: 50,
    maxHp: 250,
  },
  emoji: "⛑️",
},

{
  id: "common_battle_armor",
  name: "Common Battle Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 35,
  price: 1100,
  description: "+100 DEF, +500 HP",
  stats: {
    attack: 0,
    defense: 100,
    maxHp: 500,
  },
  emoji: "🛡️",
},

{
  id: "common_battle_gloves",
  name: "Common Battle Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 35,
  price: 1100,
  description: "+35 ATK, +35 DEF, +120 HP",
  stats: {
    attack: 35,
    defense: 35,
    maxHp: 120,
  },
  emoji: "🧤",
},

{
  id: "common_battle_pants",
  name: "Common Battle Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 35,
  price: 1100,
  description: "+65 DEF, +320 HP",
  stats: {
    attack: 0,
    defense: 65,
    maxHp: 320,
  },
  emoji: "👖",
},

{
  id: "common_battle_boots",
  name: "Common Battle Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 35,
  price: 1100,
 description: "+48 DEF, +220 HP",
  stats: {
    attack: 0,
    defense: 48,
    maxHp: 220,
  },
  emoji: "🥾",
},
// =========================
// LEVEL 40 SET
// =========================

{
  id: "common_valor_sword",
  name: "Common Valor Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 40,
  price: 1150,
  description: "+160 ATK",
  stats: {
    attack: 160,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_valor_helmet",
  name: "Common Valor Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 40,
  price: 1200,
  description: "+65 DEF, +320 HP",
  stats: {
    attack: 0,
    defense: 65,
    maxHp: 320,
  },
  emoji: "⛑️",
},

{
  id: "common_valor_armor",
  name: "Common Valor Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 40,
  price: 1250,
  description: "+130 DEF, +650 HP",
  stats: {
    attack: 0,
    defense: 130,
    maxHp: 650,
  },
  emoji: "🛡️",
},

{
  id: "common_valor_gloves",
  name: "Common Valor Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 40,
  price: 1250,
  description: "+45 ATK, +45 DEF, +150 HP",
  stats: {
    attack: 45,
    defense: 45,
    maxHp: 150,
  },
  emoji: "🧤",
},

{
  id: "common_valor_pants",
  name: "Common Valor Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 40,
  price: 1250,
  description: "+85 DEF, +420 HP",
  stats: {
    attack: 0,
    defense: 85,
    maxHp: 420,
  },
  emoji: "👖",
},

{
  id: "common_valor_boots",
  name: "Common Valor Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 40,
  price: 1250,
  description: "+60 DEF, +280 HP",
  stats: {
    attack: 0,
    defense: 60,
    maxHp: 280,
  },
  emoji: "🥾",
},

// =========================
// LEVEL 45 SET
// =========================

{
  id: "common_rune_sword",
  name: "Common Rune Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 45,
  price: 1300,
  description: "+195 ATK",
  stats: {
    attack: 195,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_rune_helmet",
  name: "Common Rune Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 45,
  price: 1350,
  description: "+82 DEF, +400 HP",
  stats: {
    attack: 0,
    defense: 82,
    maxHp: 400,
  },
  emoji: "⛑️",
},

{
  id: "common_rune_armor",
  name: "Common Rune Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 45,
  price: 1400,
  description: "+165 DEF, +820 HP",
  stats: {
    attack: 0,
    defense: 165,
    maxHp: 820,
  },
  emoji: "🛡️",
},

{
  id: "common_rune_gloves",
  name: "Common Rune Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 45,
  price: 1400,
  description: "+58 ATK, +58 DEF, +190 HP",
  stats: {
    attack: 58,
    defense: 58,
    maxHp: 190,
  },
  emoji: "🧤",
},

{
  id: "common_rune_pants",
  name: "Common Rune Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 45,
  price: 1400,
  description: "+110 DEF, +520 HP",
  stats: {
    attack: 0,
    defense: 110,
    maxHp: 520,
  },
  emoji: "👖",
},

{
  id: "common_rune_boots",
  name: "Common Rune Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 45,
  price: 1400,
  description: "+78 DEF, +350 HP",
  stats: {
    attack: 0,
    defense: 78,
    maxHp: 350,
  },
  emoji: "🥾",
},
// =========================
// LEVEL 50 SET
// =========================

{
  id: "common_titan_sword",
  name: "Common Titan Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 50,
  price: 1450,
  description: "+235 ATK",
  stats: {
    attack: 235,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_titan_helmet",
  name: "Common Titan Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 50,
  price: 1500,
  description: "+102 DEF, +500 HP",
  stats: {
    attack: 0,
    defense: 102,
    maxHp: 500,
  },
  emoji: "⛑️",
},

{
  id: "common_titan_armor",
  name: "Common Titan Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 50,
  price: 1550,
  description: "+205 DEF, +1050 HP",
  stats: {
    attack: 0,
    defense: 205,
    maxHp: 1050,
  },
  emoji: "🛡️",
},

{
  id: "common_titan_gloves",
  name: "Common Titan Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 50,
  price: 1550,
  description: "+72 ATK, +72 DEF, +240 HP",
  stats: {
    attack: 72,
    defense: 72,
    maxHp: 240,
  },
  emoji: "🧤",
},

{
  id: "common_titan_pants",
  name: "Common Titan Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 50,
  price: 1550,
  description: "+138 DEF, +650 HP",
  stats: {
    attack: 0,
    defense: 138,
    maxHp: 650,
  },
  emoji: "👖",
},

{
  id: "common_titan_boots",
  name: "Common Titan Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 50,
  price: 1550,
  description: "+98 DEF, +450 HP",
  stats: {
    attack: 0,
    defense: 98,
    maxHp: 450,
  },
  emoji: "🥾",
},

// =========================
// LEVEL 55 SET
// =========================

{
  id: "common_warborn_sword",
  name: "Common Warborn Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 55,
  price: 1600,
  description: "+280 ATK",
  stats: {
    attack: 280,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_warborn_helmet",
  name: "Common Warborn Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 55,
  price: 1650,
  description: "+125 DEF, +620 HP",
  stats: {
    attack: 0,
    defense: 125,
    maxHp: 620,
  },
  emoji: "⛑️",
},

{
  id: "common_warborn_armor",
  name: "Common Warborn Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 55,
  price: 1700,
  description: "+250 DEF, +1280 HP",
  stats: {
    attack: 0,
    defense: 250,
    maxHp: 1280,
  },
  emoji: "🛡️",
},

{
  id: "common_warborn_gloves",
  name: "Common Warborn Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 55,
  price: 1700,
  description: "+88 ATK, +88 DEF, +300 HP",
  stats: {
    attack: 88,
    defense: 88,
    maxHp: 300,
  },
  emoji: "🧤",
},

{
  id: "common_warborn_pants",
  name: "Common Warborn Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 55,
  price: 1700,
  description: "+168 DEF, +800 HP",
  stats: {
    attack: 0,
    defense: 168,
    maxHp: 800,
  },
  emoji: "👖",
},

{
  id: "common_warborn_boots",
  name: "Common Warborn Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 55,
  price: 1700,
  description: "+120 DEF, +550 HP",
  stats: {
    attack: 0,
    defense: 120,
    maxHp: 550,
  },
  emoji: "🥾",
},
// =========================
// LEVEL 60 SET
// =========================

{
  id: "common_ancient_sword",
  name: "Common Ancient Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 60,
  price: 1750,
  description: "+330 ATK",
  stats: {
    attack: 330,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_ancient_helmet",
  name: "Common Ancient Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 60,
  price: 1800,
  description: "+150 DEF, +750 HP",
  stats: {
    attack: 0,
    defense: 150,
    maxHp: 750,
  },
  emoji: "⛑️",
},

{
  id: "common_ancient_armor",
  name: "Common Ancient Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 60,
  price: 1850,
  description: "+300 DEF, +1550 HP",
  stats: {
    attack: 0,
    defense: 300,
    maxHp: 1550,
  },
  emoji: "🛡️",
},

{
  id: "common_ancient_gloves",
  name: "Common Ancient Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 60,
  price: 1850,
  description: "+105 ATK, +105 DEF, +360 HP",
  stats: {
    attack: 105,
    defense: 105,
    maxHp: 360,
  },
  emoji: "🧤",
},

{
  id: "common_ancient_pants",
  name: "Common Ancient Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 60,
  price: 1850,
  description: "+200 DEF, +980 HP",
  stats: {
    attack: 0,
    defense: 200,
    maxHp: 980,
  },
  emoji: "👖",
},

{
  id: "common_ancient_boots",
  name: "Common Ancient Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 60,
  price: 1850,
  description: "+145 DEF, +680 HP",
  stats: {
    attack: 0,
    defense: 145,
    maxHp: 680,
  },
  emoji: "🥾",
},

// =========================
// LEVEL 65 SET
// =========================

{
  id: "common_storm_sword",
  name: "Common Storm Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 65,
  price: 1900,
  description: "+385 ATK",
  stats: {
    attack: 385,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_storm_helmet",
  name: "Common Storm Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 65,
  price: 1950,
  description: "+178 DEF, +900 HP",
  stats: {
    attack: 0,
    defense: 178,
    maxHp: 900,
  },
  emoji: "⛑️",
},

{
  id: "common_storm_armor",
  name: "Common Storm Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 65,
  price: 2000,
  description: "+355 DEF, +1850 HP",
  stats: {
    attack: 0,
    defense: 355,
    maxHp: 1850,
  },
  emoji: "🛡️",
},

{
  id: "common_storm_gloves",
  name: "Common Storm Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 65,
  price: 2000,
  description: "+125 ATK, +125 DEF, +430 HP",
  stats: {
    attack: 125,
    defense: 125,
    maxHp: 430,
  },
  emoji: "🧤",
},

{
  id: "common_storm_pants",
  name: "Common Storm Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 65,
  price: 2000,
  description: "+235 DEF, +1150 HP",
  stats: {
    attack: 0,
    defense: 235,
    maxHp: 1150,
  },
  emoji: "👖",
},

{
  id: "common_storm_boots",
  name: "Common Storm Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 65,
 price: 2000,
  description: "+170 DEF, +800 HP",
  stats: {
    attack: 0,
    defense: 170,
    maxHp: 800,
  },
  emoji: "🥾",
},
// =========================
// LEVEL 70 SET
// =========================

{
  id: "common_inferno_sword",
  name: "Common Inferno Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 70,
  price: 2050,
  description: "+445 ATK",
  stats: {
    attack: 445,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_inferno_helmet",
  name: "Common Inferno Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 70,
  price: 2100,
  description: "+210 DEF, +1050 HP",
  stats: {
    attack: 0,
    defense: 210,
    maxHp: 1050,
  },
  emoji: "⛑️",
},

{
  id: "common_inferno_armor",
  name: "Common Inferno Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 70,
  price: 2150,
  description: "+420 DEF, +2200 HP",
  stats: {
    attack: 0,
    defense: 420,
    maxHp: 2200,
  },
  emoji: "🛡️",
},

{
  id: "common_inferno_gloves",
  name: "Common Inferno Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 70,
  price: 2150,
  description: "+148 ATK, +148 DEF, +520 HP",
  stats: {
    attack: 148,
    defense: 148,
    maxHp: 520,
  },
  emoji: "🧤",
},

{
  id: "common_inferno_pants",
  name: "Common Inferno Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 70,
  price: 2150,
  description: "+275 DEF, +1380 HP",
  stats: {
    attack: 0,
    defense: 275,
    maxHp: 1380,
  },
  emoji: "👖",
},

{
  id: "common_inferno_boots",
  name: "Common Inferno Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 70,
  price: 2150,
  description: "+198 DEF, +960 HP",
  stats: {
    attack: 0,
    defense: 198,
    maxHp: 960,
  },
  emoji: "🥾",
},

// =========================
// LEVEL 75 SET
// =========================

{
  id: "common_abyss_sword",
  name: "Common Abyss Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 75,
  price: 2200,
  description: "+510 ATK",
  stats: {
    attack: 510,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_abyss_helmet",
  name: "Common Abyss Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 75,
  price: 2250,
  description: "+245 DEF, +1250 HP",
  stats: {
    attack: 0,
    defense: 245,
    maxHp: 1250,
  },
  emoji: "⛑️",
},

{
  id: "common_abyss_armor",
  name: "Common Abyss Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 75,
  price: 2300,
  description: "+490 DEF, +2600 HP",
  stats: {
    attack: 0,
    defense: 490,
    maxHp: 2600,
  },
  emoji: "🛡️",
},

{
  id: "common_abyss_gloves",
  name: "Common Abyss Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 75,
  price: 2300,
  description: "+172 ATK, +172 DEF, +620 HP",
  stats: {
    attack: 172,
    defense: 172,
    maxHp: 620,
  },
  emoji: "🧤",
},

{
  id: "common_abyss_pants",
  name: "Common Abyss Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 75,
  price: 2300,
  description: "+320 DEF, +1650 HP",
  stats: {
    attack: 0,
    defense: 320,
    maxHp: 1650,
  },
  emoji: "👖",
},

{
  id: "common_abyss_boots",
  name: "Common Abyss Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 75,
  price: 2300,
  description: "+230 DEF, +1150 HP",
  stats: {
    attack: 0,
    defense: 230,
    maxHp: 1150,
  },
  emoji: "🥾",
},
// =========================
// LEVEL 80 SET
// =========================

{
  id: "common_celestial_sword",
  name: "Common Celestial Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 80,
  price: 2350,
  description: "+585 ATK",
  stats: {
    attack: 585,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_celestial_helmet",
  name: "Common Celestial Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 80,
  price: 2400,
  description: "+285 DEF, +1450 HP",
  stats: {
    attack: 0,
    defense: 285,
    maxHp: 1450,
  },
  emoji: "⛑️",
},

{
  id: "common_celestial_armor",
  name: "Common Celestial Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 80,
  price: 2450,
  description: "+570 DEF, +3050 HP",
  stats: {
    attack: 0,
    defense: 570,
    maxHp: 3050,
  },
  emoji: "🛡️",
},

{
  id: "common_celestial_gloves",
  name: "Common Celestial Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 80,
  price: 2450,
  description: "+198 ATK, +198 DEF, +730 HP",
  stats: {
    attack: 198,
    defense: 198,
    maxHp: 730,
  },
  emoji: "🧤",
},

{
  id: "common_celestial_pants",
  name: "Common Celestial Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 80,
  price: 2450,
  description: "+370 DEF, +1920 HP",
  stats: {
    attack: 0,
    defense: 370,
    maxHp: 1920,
  },
  emoji: "👖",
},

{
  id: "common_celestial_boots",
  name: "Common Celestial Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 80,
  price: 2450,
  description: "+265 DEF, +1350 HP",
  stats: {
    attack: 0,
    defense: 265,
    maxHp: 1350,
  },
  emoji: "🥾",
},

// =========================
// LEVEL 85 SET
// =========================

{
  id: "common_dragon_sword",
  name: "Common Dragon Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 85,
  price: 2500,
  description: "+665 ATK",
  stats: {
    attack: 665,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_dragon_helmet",
  name: "Common Dragon Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 85,
  price: 2550,
  description: "+330 DEF, +1700 HP",
  stats: {
    attack: 0,
    defense: 330,
    maxHp: 1700,
  },
  emoji: "⛑️",
},

{
  id: "common_dragon_armor",
  name: "Common Dragon Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 85,
  price: 2600,
  description: "+660 DEF, +3550 HP",
  stats: {
    attack: 0,
    defense: 660,
    maxHp: 3550,
  },
  emoji: "🛡️",
},

{
  id: "common_dragon_gloves",
  name: "Common Dragon Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 85,
  price: 2600,
  description: "+225 ATK, +225 DEF, +850 HP",
  stats: {
    attack: 225,
    defense: 225,
    maxHp: 850,
  },
  emoji: "🧤",
},

{
  id: "common_dragon_pants",
  name: "Common Dragon Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 85,
  price: 2600,
  description: "+425 DEF, +2250 HP",
  stats: {
    attack: 0,
    defense: 425,
    maxHp: 2250,
  },
  emoji: "👖",
},

{
  id: "common_dragon_boots",
  name: "Common Dragon Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 85,
  price: 2600,
  description: "+305 DEF, +1580 HP",
  stats: {
    attack: 0,
    defense: 305,
    maxHp: 1580,
  },
  emoji: "🥾",
},
// =========================
// LEVEL 90 SET
// =========================

{
  id: "common_elder_dragon_sword",
  name: "Common Elder Dragon Sword",
  type: "Weapon",
  quality: "Common",
  requiredLevel: 90,
  price: 2650,
  description: "+750 ATK",
  stats: {
    attack: 750,
    defense: 0,
    maxHp: 0,
  },
  emoji: "🗡️",
},

{
  id: "common_elder_dragon_helmet",
  name: "Common Elder Dragon Helmet",
  type: "Helmet",
  quality: "Common",
  requiredLevel: 90,
  price: 2700,
  description: "+380 DEF, +2000 HP",
  stats: {
    attack: 0,
    defense: 380,
    maxHp: 2000,
  },
  emoji: "⛑️",
},

{
  id: "common_elder_dragon_armor",
  name: "Common Elder Dragon Armor",
  type: "Armor",
  quality: "Common",
  requiredLevel: 90,
  price: 2750,
  description: "+760 DEF, +4200 HP",
  stats: {
    attack: 0,
    defense: 760,
    maxHp: 4200,
  },
  emoji: "🛡️",
},

{
  id: "common_elder_dragon_gloves",
  name: "Common Elder Dragon Gloves",
  type: "Gloves",
  quality: "Common",
  requiredLevel: 90,
  price: 2750,
  description: "+255 ATK, +255 DEF, +1000 HP",
  stats: {
    attack: 255,
    defense: 255,
    maxHp: 1000,
  },
  emoji: "🧤",
},

{
  id: "common_elder_dragon_pants",
  name: "Common Elder Dragon Pants",
  type: "Pants",
  quality: "Common",
  requiredLevel: 90,
  price: 2750,
  description: "+485 DEF, +2700 HP",
  stats: {
    attack: 0,
    defense: 485,
    maxHp: 2700,
  },
  emoji: "👖",
},

{
  id: "common_elder_dragon_boots",
  name: "Common Elder Dragon Boots",
  type: "Boots",
  quality: "Common",
  requiredLevel: 90,
  price: 2750,
  description: "+350 DEF, +1900 HP",
  stats: {
    attack: 0,
    defense: 350,
    maxHp: 1900,
  },
  emoji: "🥾",
},
];

module.exports = shopItems;