const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { db } = require("../../firebase/firebase");
const { getQualityEmoji } = require("../utils/qualitySystem");

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

module.exports = async function inventoryCommand(message) {
  const userId = message.author.id;
  const playerRef = db.collection("players").doc(userId);

  const playerDoc = await playerRef.get();

  if (!playerDoc.exists) {
    return message.reply(
      "You don’t have a character yet. Use `!s start` first."
    );
  }

  const player = playerDoc.data();
  const inventory = Array.isArray(player.inventory)
    ? player.inventory
    : [];

  const itemsPerPage = 8;
  let currentPage = 0;

  const totalPages = Math.max(
    1,
    Math.ceil(inventory.length / itemsPerPage)
  );

  function createEmbed(page) {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = inventory.slice(start, end);

    const itemsText =
      currentItems.length === 0
        ? "❌ Inventory Empty"
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
                `└ 🎭 ${formatClass(
                  item.compatibleClasses || ["all"]
                )}\n` +
                `└ 📊 ${formatStats(item.stats || {})}\n` +
                `└ 🏷️ \`${item.id || "no-id"}\``
              );
            })
            .join("\n\n");

    return new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle("🎒 SYXTH INVENTORY")
      .setDescription(
        `👤 ${player.username || message.author.username}\n` +
          `🎭 Class: ${player.class || "Unknown"}\n` +
          `🪙 Gold: ${player.gold || 0}\n\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          itemsText
      )
      .setThumbnail(
        message.author.displayAvatarURL({
          dynamic: true,
        })
      )
      .setFooter({
        text: `Items: ${inventory.length} • Page ${
          page + 1
        }/${totalPages}`,
      });
  }

  function createButtons(page) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("inventory_prev")
        .setLabel("Previous")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId("inventory_next")
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
  });

  collector.on("collect", async (interaction) => {
    if (interaction.user.id !== message.author.id) {
      return interaction.reply({
        content: "❌ This inventory is not yours.",
        ephemeral: true,
      });
    }

    if (interaction.customId === "inventory_prev") {
      currentPage--;
    }

    if (interaction.customId === "inventory_next") {
      currentPage++;
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