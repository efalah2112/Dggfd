const { SlashCommandBuilder, Collection, Events, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, MessageComponentCollector, ButtonStyle, Embed } = require("discord.js");
  /**
   * @param {Interaction} interaction
   */
module.exports = client => {
  client.on("interactionCreate", async interaction => {
    if (interaction.isModalSubmit()) {
      if (interaction.customId == 'compare') {
        await interaction.deferReply({ ephemeral: true });
        let tashfeermsg = interaction.fields.getTextInputValue(`tashfeermsg`);
        if (!tashfeermsg) return interaction.editReply({ content: `**الرجاء كتابة الجملة المراد تشفيرها**` });


          const replacements = {
          "بيع": "بيـ.ـع",
          "شراء": "شر1ء",
          "سعر": "س3ر",
          "عروض": "عر9ض",
          "عرض": "عـ.ـرض",
          "متوفر": "مت٩فر",
          "اوفر": "ا9فر",
          "نيترو": "نيتر9",
          "متجر": "م3جر",
          "متجرك": "م3جرك",
          "شوب": "ش9ب",
          "تبادل": "تب1دل",
          "متاجر": "م3اجر",
          "متجري": "م3جره",
          "اطلب": "اط1ب",
          "ابيع": "ابي3",
          "للبيع": "للبي3",
          "هبيع": "هبي3",
          "بلوكس": "بل9كس",
          "مطلوب": "مطل9ب",
          "فواكه": "ف9اكه",
          "بوستات": "ب9ستات",
          "حسابي": "حس1بي",
          "حسابك": "حس1بك",
          "حساب": "حس1ب",
          "ستور": "ست9ر",
          "دولار": "د9لار",
          "كريدت": "كريـ.ـدت",
           "كردت": "كـrدت",
        };
          let modifiedMsg = tashfeermsg;
          for (const [keyword, replacement] of Object.entries(replacements)) {
              const regex = new RegExp(keyword, 'g');
              modifiedMsg = modifiedMsg.replace(regex, replacement);
          }
          await interaction.editReply({
             content: `تم تشفير منشورك ${modifiedMsg} .`,
            ephemeral: true
          })
          await interaction.user.send({ content: `   ${modifiedMsg} .`});
          
          
          
          
      }
    }
  })
};