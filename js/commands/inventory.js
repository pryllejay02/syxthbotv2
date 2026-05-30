const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");

const ITEMS_PER_PAGE = 8;

function getItemEmoji(item) {
  if (item.emoji) return item.emoji;

  const type = String(item.type || "").toLowerCase();

  if (type === "weapon") return "🗡️";
  if (type === "helmet") return "⛑️";
  if (type === "armor") return "🥋";
  if (type === "gloves") return "🧤";
  if (type === "pants") return "👖";
  if (type === "boots") return "🥾";
  if (type === "consumable") return "🧪";

  return "📦";
}

function formatClass(classes = []) {
  if (!Array.isArray(classes)) return "All";

  return classes
    .map((cls) => {
      const text = String(cls || "all");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(", ");
}

function formatStats(stats = {}) {
  const result = [];

  if (stats.attack) result.push(`⚔️ +${stats.attack}`);
  if (stats.defense) result.push(`🛡️ +${stats.defense}`);
  if (stats.maxHp) result.push(`❤️ +${stats.maxHp}`);
  if (stats.dodge) result.push(`💨 +${stats.dodge}%`);
  if (stats.crit) result.push(`💥 +${stats.crit}%`);

  return result.length ? result.join(" • ") : "No stats";
}

function getTotalQuantity(items = []) {
  return items.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );
}

function filterInventory(inventory, filter) {
  const normalized = String(filter || "all").toLowerCase();

  if (normalized === "all") return inventory;

  if (normalized === "equipment") {
    return inventory.filter(
      (item) => String(item.type || "").toLowerCase() !== "consumable"
    );
  }

  if (normalized === "consumable" || normalized === "consumables") {
    return inventory.filter(
      (item) => String(item.type || "").toLowerCase() === "consumable"
    );
  }

  if (["common", "rare", "legendary", "starter"].includes(normalized)) {
    return inventory.filter(
      (item) => String(item.quality || "Common").toLowerCase() === normalized
    );
  }

  return null;
}

function sortInventory(items = []) {
  const qualityOrder = {
    Legendary: 1,
    Rare: 2,
    Common: 3,
    Starter: 4,
  };

  const typeOrder = {
    Weapon: 1,
    Helmet: 2,
    Armor: 3,
    Gloves: 4,
    Pants: 5,
    Boots: 6,
    Consumable: 7,
  };

  return [...items].sort((a, b) => {
    const qualityA = qualityOrder[a.quality] || 99;
    const qualityB = qualityOrder[b.quality] || 99;

    if (qualityA !== qualityB) return qualityA - qualityB;

    const levelA = Number(a.requiredLevel || 1);
    const levelB = Number(b.requiredLevel || 1);

    if (levelA !== levelB) return levelB - levelA;

    const typeA = typeOrder[a.type] || 99;
    const typeB = typeOrder[b.type] || 99;

    if (typeA !== typeB) return typeA - typeB;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getFilterLabel(filter) {
  const normalized = String(filter || "all").toLowerCase();

  const labels = {
    all: "All Items",
    equipment: "Equipment",
    consumable: "Consumables",
    consumables: "Consumables",
    common: "Common Items",
    rare: "Rare Items",
    legendary: "Legendary Items",
    starter: "Starter Items",
  };

  return labels[normalized] || "All Items";
}

module.exports = async function inventoryCommand(message, args = []) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const filter = String(args[0] || "all").toLowerCase();

  const validFilters = [
    "all",
    "equipment",
    "consumable",
    "consumables",
    "common",
    "rare",
    "legendary",
    "starter",
  ];

  if (!validFilters.includes(filter)) {
    return message.reply(
      "❌ Invalid inventory filter.\n\n" +
        "Use:\n" +
        "`!s inventory all`\n" +
        "`!s inventory equipment`\n" +
        "`!s inventory consumable`\n" +
        "`!s inventory common`\n" +
        "`!s inventory rare`\n" +
        "`!s inventory legendary`"
    );
  }

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();

  const rawInventory = Array.isArray(player.inventory)
    ? player.inventory
    : [];

  const filtered = filterInventory(rawInventory, filter);

  if (!filtered) {
    return message.reply("❌ Invalid inventory filter.");
  }

  const inventory = sortInventory(filtered);

  let currentPage = 0;

  const totalPages = Math.max(
    1,
    Math.ceil(inventory.length / ITEMS_PER_PAGE)
  );

  const filterLabel = getFilterLabel(filter);
  const totalQuantity = getTotalQuantity(inventory);
  const allQuantity = getTotalQuantity(rawInventory);

  function createEmbed(page) {
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentItems = inventory.slice(start, end);

    const itemsText =
      currentItems.length === 0
        ? "❌ No items found for this filter."
        : currentItems
            .map((item) => {
              const emoji = getItemEmoji(item);

              const qualityEmoji = getQualityEmoji(
                item.quality || "Common"
              );

              const quantity = Number(item.quantity || 1);

              return (
                `${emoji} **${item.name || "Unknown Item"}** x${quantity}\n` +
                `└ ${qualityEmoji} ${item.quality || "Common"} • ${
                  item.type || "Unknown"
                }\n` +
                `└ 🔓 Lv.${item.requiredLevel || 1}\n` +
                `└ 🎭 ${formatClass(item.compatibleClasses || ["all"])}\n` +
                `└ 📊 ${formatStats(item.stats || {})}\n` +
                `└ 💰 Price: ${item.price || 0} Gold\n` +
                `└ 🏷️ \`${item.id || "no-id"}\``
              );
            })
            .join("\n\n");

    return new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle(`🎒 SYXTH INVENTORY • ${filterLabel}`)
      .setDescription(
        `👤 **${player.username || message.author.username}**\n` +
          `🎭 Class: **${player.class || "Unknown"}**\n` +
          `🪙 Gold: **${player.gold || 0}**\n` +
          `📦 Showing: **${inventory.length} stacks / ${totalQuantity} total items**\n` +
          `🎒 Full Inventory: **${rawInventory.length} stacks / ${allQuantity} total items**\n\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          itemsText
      )
      .setThumbnail(
        message.author.displayAvatarURL({
          dynamic: true,
        })
      )
      .setFooter({
        text: `Page ${page + 1}/${totalPages} • Filter: ${filterLabel}`,
      });
  }

  function createButtons(page) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`inventory_prev_${userId}`)
        .setLabel("Previous")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId(`inventory_next_${userId}`)
        .setLabel("Next")
        .setEmoji("➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages - 1)
    );
  }

  const reply = await message.reply({
    embeds: [createEmbed(currentPage)],
    components: totalPages > 1 ? [createButtons(currentPage)] : [],
  });

  if (totalPages <= 1) return;

  const collector = reply.createMessageComponentCollector({
    time: 120000,
    filter: (interaction) =>
      interaction.user.id === userId &&
      [
        `inventory_prev_${userId}`,
        `inventory_next_${userId}`,
      ].includes(interaction.customId),
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === `inventory_prev_${userId}`) {
      currentPage = Math.max(0, currentPage - 1);
    }

    if (interaction.customId === `inventory_next_${userId}`) {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
    }

    await interaction.update({
      embeds: [createEmbed(currentPage)],
      components: [createButtons(currentPage)],
    });
  });

  collector.on("end", async () => {
    await reply
      .edit({
        components: [],
      })
      .catch(() => {});
  });
};