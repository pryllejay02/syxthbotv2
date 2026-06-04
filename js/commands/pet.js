const { EmbedBuilder } = require("discord.js");
const { db } = require("../../firebase/firebase");
const { calculateTotalStats } = require("../utils/statSystem");
const balanceConfig = require("../data/balanceConfig");

const {
  DEFAULT_PETS_PER_PAGE,
  normalizePets,
  getActivePet,
  equipPet,
  unequipPet,
  lockPet,
  unlockPet,
  findPlayerPet,
  getPetSellPrice,
  sellPet,
  bulkSellPets,
  filterPets,
  sortPets,
  paginatePets,
  formatPetDisplay,
  formatPetListPage,
  getPetMaxLevel,
  getPetExpDisplay,
  getPetDisplayEmoji,
  calculatePetStats,
  formatPetStats,
  formatPetStatus,
  applyPetStats,
} = require("../utils/petSystem");

function getPetColor(quality = "Common") {
  const normalized = String(quality || "Common").toLowerCase();

  if (normalized === "legendary") return "#F59E0B";
  if (normalized === "rare") return "#3B82F6";

  return "#22C55E";
}

function createEmbed(title, description, color = "#8B0000") {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "Syxth MMORPG • Pet System",
    })
    .setTimestamp();
}

function parseListArgs(args = []) {
  const first = String(args[1] || "all").toLowerCase();
  const second = String(args[2] || "1").toLowerCase();

  if (!Number.isNaN(Number(first))) {
    return {
      filter: "all",
      page: Number(first),
    };
  }

  return {
    filter: first || "all",
    page: Number(second || 1),
  };
}

function getPetStatUpdate(player = {}, pets = [], activePetId = null) {
  const level = Math.max(1, Number(player.level || 1));
  const classId = player.classId || "swordsman";

  const baseStats =
    typeof balanceConfig.getBaseStatsByClassLevel === "function"
      ? balanceConfig.getBaseStatsByClassLevel(classId, level)
      : player.baseStats || {};

  const equipment = player.equipment || {};
  const equipmentStats = calculateTotalStats(baseStats, equipment);

  const activePet = getActivePet({
    ...player,
    pets,
    activePetId,
  });

  const totalStats = applyPetStats(equipmentStats, activePet);

  const hp = Math.min(
    Math.max(0, Number(player.hp ?? totalStats.maxHp)),
    Number(totalStats.maxHp || 100)
  );

  return {
    baseStats,
    hp,
    maxHp: totalStats.maxHp,
    attack: totalStats.attack,
    defense: totalStats.defense,
    dodge: totalStats.dodge,
    crit: totalStats.crit,
  };
}

function getValidFiltersText() {
  return (
    "Valid filters:\n" +
    "`all`, `active`, `locked`, `unlocked`, `common`, `rare`, `legendary`, " +
    "`attack`, `tank`, `support`, `critical`, `evasion`, `balanced`"
  );
}

function formatPetInfo(pet, player = {}) {
  const maxLevel = getPetMaxLevel(pet);
  const petStats = calculatePetStats(pet);
  const sellPrice = getPetSellPrice(pet);
  const displayEmoji = getPetDisplayEmoji(pet);

  return (
    `${displayEmoji} **${pet.name || "Unknown Pet"}**\n\n` +
    `Quality: **${pet.qualityEmoji || ""} ${pet.quality || "Common"}**\n` +
    `Type: **${String(pet.type || "balanced").toUpperCase()}**\n` +
    `Level: **${pet.level || 1}/${maxLevel}**\n` +
    `EXP: **${getPetExpDisplay(pet)}**\n` +
    `Required Tier: **Lv.${pet.requiredLevel || 1}**\n` +
    `Status: **${formatPetStatus(pet, player.activePetId)}**\n` +
    `Sell Value: **${sellPrice} Gold**\n` +
    `Source: **${pet.source || "unknown"}**\n` +
    `ID: \`${pet.id}\`\n\n` +
    `Passive Bonus:\n${formatPetStats(petStats)}\n\n` +
    `Commands:\n` +
    `\`!s pet equip ${pet.id}\`\n` +
    `\`!s pet lock ${pet.id}\` / \`!s pet unlock ${pet.id}\`\n` +
    `\`!s pet sell ${pet.id}\``
  );
}

module.exports = async function petCommand(message, args = []) {
  const subCommand = String(args[0] || "show").toLowerCase();
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  if (["help", "commands"].includes(subCommand)) {
    return message.reply({
      embeds: [
        createEmbed(
          "🐾 SYXTH PET COMMANDS",
          "`!s pet` - Show active pet\n" +
            "`!s pet list <filter> <page>` - View pet list with filters/pages\n" +
            "`!s pet info <pet_id>` - View pet details\n" +
            "`!s pet equip <pet_id>` - Activate a pet\n" +
            "`!s pet unequip` - Remove active pet\n" +
            "`!s pet lock <pet_id>` - Lock pet from selling/trading\n" +
            "`!s pet unlock <pet_id>` - Unlock pet\n" +
            "`!s pet sell <pet_id>` - Sell one unlocked pet\n" +
            "`!s pet sell all common|rare|legendary` - Bulk sell unlocked pets\n\n" +
            getValidFiltersText()
        ),
      ],
    });
  }

  if (subCommand === "list") {
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      return message.reply(
        "❌ You don’t have a character yet. Use `!s start` first."
      );
    }

    const player = playerDoc.data();
    const { filter, page } = parseListArgs(args);

    const filteredPets = filterPets(
      player.pets || [],
      filter,
      player.activePetId
    );

    if (!filteredPets) {
      return message.reply("❌ Invalid pet filter.\n\n" + getValidFiltersText());
    }

    const sortedPets = sortPets(filteredPets);
    const pageData = paginatePets(sortedPets, page, DEFAULT_PETS_PER_PAGE);

    return message.reply({
      embeds: [
        createEmbed(
          "🐾 SYXTH PETS",
          formatPetListPage({
            pets: pageData.pets,
            filter,
            page: pageData.page,
            totalPages: pageData.totalPages,
            activePetId: player.activePetId,
          })
        ),
      ],
    });
  }

  if (subCommand === "info") {
    const petId = args[1];

    if (!petId) {
      return message.reply("❌ Usage: `!s pet info <pet_id>`");
    }

    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      return message.reply(
        "❌ You don’t have a character yet. Use `!s start` first."
      );
    }

    const player = playerDoc.data();
    const pet = findPlayerPet(player, petId);

    if (!pet) {
      return message.reply("❌ You don’t have that pet.");
    }

    return message.reply({
      embeds: [
        createEmbed(
          "🐾 PET INFO",
          formatPetInfo(pet, player),
          getPetColor(pet.quality)
        ),
      ],
    });
  }

  if (subCommand === "equip") {
    const petId = args[1];

    if (!petId) {
      return message.reply("❌ Usage: `!s pet equip <pet_id>`");
    }

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You don’t have a character yet. Use `!s start` first.",
        };
      }

      const player = playerDoc.data();
      const equipResult = equipPet(player, petId);

      if (!equipResult.ok) return equipResult;

      const statUpdate = getPetStatUpdate(
        player,
        equipResult.pets,
        equipResult.activePetId
      );

      transaction.update(playerRef, {
        pets: equipResult.pets,
        activePetId: equipResult.activePetId,
        ...statUpdate,
        updatedAt: new Date(),
      });

      return equipResult;
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to equip pet.");
    }

    return message.reply(
      `✅ ${getPetDisplayEmoji(result.pet)} **${result.pet.name}** is now your active pet.`
    );
  }

  if (subCommand === "unequip") {
    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You don’t have a character yet. Use `!s start` first.",
        };
      }

      const player = playerDoc.data();
      const unequipResult = unequipPet(player);

      const statUpdate = getPetStatUpdate(player, unequipResult.pets, null);

      transaction.update(playerRef, {
        pets: unequipResult.pets,
        activePetId: null,
        ...statUpdate,
        updatedAt: new Date(),
      });

      return unequipResult;
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to unequip pet.");
    }

    if (!result.pet) {
      return message.reply("✅ You have no active pet equipped.");
    }

    return message.reply(
      `✅ Unequipped ${getPetDisplayEmoji(result.pet)} **${result.pet.name}**.`
    );
  }

  if (subCommand === "lock" || subCommand === "unlock") {
    const petId = args[1];

    if (!petId) {
      return message.reply(`❌ Usage: \`!s pet ${subCommand} <pet_id>\``);
    }

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You don’t have a character yet. Use `!s start` first.",
        };
      }

      const player = playerDoc.data();

      const updateResult =
        subCommand === "lock"
          ? lockPet(player, petId)
          : unlockPet(player, petId);

      if (!updateResult.ok) return updateResult;

      transaction.update(playerRef, {
        pets: updateResult.pets,
        updatedAt: new Date(),
      });

      return updateResult;
    });

    if (!result.ok) {
      return message.reply(
        result.message || "❌ Failed to update pet lock status."
      );
    }

    return message.reply(
      `${subCommand === "lock" ? "🔒 Locked" : "🔓 Unlocked"} ${getPetDisplayEmoji(
        result.pet
      )} **${result.pet.name}**.`
    );
  }

  if (subCommand === "sell") {
    const action = String(args[1] || "").toLowerCase();

    if (!action) {
      return message.reply(
        "❌ Usage:\n" +
          "`!s pet sell <pet_id>`\n" +
          "`!s pet sell all common`\n" +
          "`!s pet sell all rare`\n" +
          "`!s pet sell all legendary`"
      );
    }

    if (action === "all") {
      const quality = String(args[2] || "").toLowerCase();
      const validQualities = ["common", "rare", "legendary"];

      if (!validQualities.includes(quality)) {
        return message.reply(
          "❌ Bulk pet sell requires a quality filter.\n\n" +
            "Use: `!s pet sell all common`, `rare`, or `legendary`."
        );
      }

      const result = await db.runTransaction(async (transaction) => {
        const playerDoc = await transaction.get(playerRef);

        if (!playerDoc.exists) {
          return {
            ok: false,
            message: "❌ You don’t have a character yet. Use `!s start` first.",
          };
        }

        const player = playerDoc.data();

        const sellResult = bulkSellPets(
          player,
          quality.charAt(0).toUpperCase() + quality.slice(1)
        );

        if (!sellResult.ok) return sellResult;

        const oldGold = Number(player.gold || 0);
        const newGold = oldGold + Number(sellResult.totalGold || 0);

        transaction.update(playerRef, {
          gold: newGold,
          pets: sellResult.pets,
          updatedAt: new Date(),
        });

        return {
          ...sellResult,
          oldGold,
          newGold,
        };
      });

      if (!result.ok) {
        return message.reply(result.message || "❌ Failed to sell pets.");
      }

      return message.reply(
        `💰 **Bulk Pet Sell Complete!**\n\n` +
          `🐾 Pets Sold: **${result.soldPets.length}**\n` +
          `🟢 Common Sold: **${result.commonSold}**\n` +
          `🔵 Rare Sold: **${result.rareSold}**\n` +
          `🟠 Legendary Sold: **${result.legendarySold}**\n\n` +
          `💰 Gold Earned: **${result.totalGold}**\n` +
          `🪙 Old Gold: **${result.oldGold}**\n` +
          `🪙 New Gold Balance: **${result.newGold}**`
      );
    }

    const petId = action;

    const result = await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        return {
          ok: false,
          message: "❌ You don’t have a character yet. Use `!s start` first.",
        };
      }

      const player = playerDoc.data();
      const sellResult = sellPet(player, petId);

      if (!sellResult.ok) return sellResult;

      const oldGold = Number(player.gold || 0);
      const newGold = oldGold + Number(sellResult.sellPrice || 0);

      transaction.update(playerRef, {
        gold: newGold,
        pets: sellResult.pets,
        activePetId: player.activePetId || null,
        updatedAt: new Date(),
      });

      return {
        ...sellResult,
        oldGold,
        newGold,
      };
    });

    if (!result.ok) {
      return message.reply(result.message || "❌ Failed to sell pet.");
    }

    return message.reply(
      `${getPetDisplayEmoji(result.pet)} Sold **${result.pet.name}**!\n\n` +
        `Quality: **${result.pet.qualityEmoji || ""} ${result.pet.quality}**\n` +
        `Level: **${result.pet.level}/${getPetMaxLevel(result.pet)}**\n` +
        `💰 Gold Earned: **${result.sellPrice} Gold**\n` +
        `🪙 Old Gold: **${result.oldGold}**\n` +
        `🪙 New Gold Balance: **${result.newGold}**`
    );
  }

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "❌ You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();
  const pets = normalizePets(player.pets || []);

  const activePet = getActivePet({
    ...player,
    pets,
  });

  if (!activePet) {
    return message.reply({
      embeds: [
        createEmbed(
          "🐾 ACTIVE PET",
          "You have no active pet.\n\nUse `!s pet list` to view your pets or hunt/raid to find pet drops."
        ),
      ],
    });
  }

  return message.reply({
    embeds: [
      createEmbed(
        "🐾 ACTIVE PET",
        formatPetDisplay(activePet, player),
        getPetColor(activePet.quality)
      ),
    ],
  });
};