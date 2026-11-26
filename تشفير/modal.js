const { SlashCommandBuilder, TextInputStyle, TextInputBuilder, ModalBuilder, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
  /**
   * @param {Interaction} interaction
   */
module.exports = (client) => {
  client.on("interactionCreate", async interaction => {
    if (interaction.isButton()) {
      if (interaction.customId == "tashfeerk") {
        const modal = new ModalBuilder()
        .setCustomId('compare')
        .setTitle('تشفير الكلمات');
        const quantity = new TextInputBuilder()
        .setCustomId('tashfeermsg')
        .setLabel("ضع الكلام الذي ترغب بتشفيره")
        .setStyle(TextInputStyle.Paragraph); 
        const firstActionRow = new ActionRowBuilder().addComponents(quantity);
        modal.addComponents(firstActionRow);
        await interaction.showModal(modal);
      }
    }
  })
}