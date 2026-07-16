const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder,
    StringSelectMenuBuilder,
    SelectMenuBuilder,
    PermissionsBitField,
    REST,
    Routes,
    ApplicationCommandOptionType,
    WebhookClient,
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType,
    Events,
    ActivityType,
    SectionBuilder,           // ✅ أضف هذا
    ThumbnailBuilder,         // ✅ أضف هذا
    MediaGalleryBuilder,      // ✅ أضف هذا
    MediaGalleryItemBuilder,  // ✅ أضف هذا
} = require("discord.js");
const D = require("./descriptions");
const _ec = require("./embedColor");
const fs = require("fs");
const ms = require("ms");
const path = require("path");
const sharp = require("sharp");
const { getAudioUrl } = require("google-tts-api");
const googleTTS = require("google-tts-api");
const emojis = require("./emojis");
const ED = require("./embedDescriptions");

// helper: resolve embed color (per-server or global config fallback)
async function getColor(guildId, _db, _config) {
    const stored = guildId ? await _db.get(`embed_color_${guildId}`) : null;
    const raw = stored || _config?.color || "0x00AE86";
    return parseInt(raw.replace("#", "").replace("0x", ""), 16);
}

// إصلاح شامل
function _buildAuctionMsg(draft, rem) {
    const m = Math.floor(rem / 60),
        s = rem % 60;
    return `${draft.mentionType}\nالمزاد\n\nالسلعة: ${draft.itemName}\nالسعر الابتدائي: ${draft.startPrice}\nالضريبة: ${draft.includesTax ? "نعم" : "لا"}\nالمدة: ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function _buildControlRow(roomId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pause_auction_${roomId}`)
            .setLabel("توقيف")
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.pause),
        new ButtonBuilder()
            .setCustomId(`resume_auction_${roomId}`)
            .setLabel("استمرار")
            .setStyle(ButtonStyle.Success)
            .setEmoji(emojis.resume),
        new ButtonBuilder()
            .setCustomId(`revive_auction_${roomId}`)
            .setLabel("انعاش")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.revive),
        new ButtonBuilder()
            .setCustomId(`extend_auction_${roomId}`)
            .setLabel("تمديد")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.extend),
        new ButtonBuilder()
            .setCustomId(`cancel_active_auction_${roomId}`)
            .setLabel("إلغاء")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis.cancelAuction),
    );
}

// ✅ إضافة الأقواس الناقصة
const auctionTimers = new Map();

async function requireAuctionAdmin(interaction, db) {
    const adminRoleId = await db.get(`auctionad_${interaction.guild.id}`);
    return adminRoleId && interaction.member.roles.cache.has(adminRoleId) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
}

async function cleanupAuctionRoom(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        for (const msg of messages.values()) {
            if (msg.author.id === channel.guild.members.me.id) {
                await msg.delete().catch(() => {});
            }
        }
    } catch {}
}

module.exports = function registerShopInteractions(
    client,
    {
        db,
        config,
        botOwner,
        allowedUserId,
        owner,
        TARGET_ROLE_ID,
        TARGET_CHANNEL_ID,
        logJoinChannel,
        allowedBotId,
        prefix,
        TARGET_GUILD_ID,
        reportsChannelId,
        reportsGuildId,
        chsd,
    },
) {
    // ====== دالة: إرسال تقييم الخدمة بالخاص بعد إغلاق التكت ======
    async function sendTicketRatingDM(userId, guildId, type) {
        const ratingChId = await db.get(`rating_ch_${guildId}`);
        if (!ratingChId) return;
        try {
            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) return;
            const typeLabels = {
                support: " دعم فني",
                scam: " تشهير",
                order: " طلبات",
                auction: " مزاد",
                roles: " رتب",
            };
            const ratingRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tr_1_${guildId}_${type}`)
                    .setLabel("⭐")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId(`tr_2_${guildId}_${type}`)
                    .setLabel("⭐⭐")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId(`tr_3_${guildId}_${type}`)
                    .setLabel("⭐⭐⭐")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId(`tr_4_${guildId}_${type}`)
                    .setLabel("⭐⭐⭐⭐")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId(`tr_5_${guildId}_${type}`)
                    .setLabel("⭐⭐⭐⭐⭐")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis.rate),
            );
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("⭐ تقييم الخدمة")
                        .setDescription(
                            ED.shopInteractions_001({ type, typeLabels }),
                        )
                        .setFooter({ text: "اضغط على النجوم لإرسال تقييمك" })
                        .setTimestamp(),
                ],
                components: [ratingRow],
            });
        } catch (e) {
            console.log(`[Rating DM] فشل إرسال لـ ${userId}: ${e.message}`);
        }
    }

    // ✅ إغلاق جميع event listeners بشكل صحيح
    client.on("messageCreate", async (message) => {
        if (!message.content.startsWith("+صوص")) return;
        if (!message.guild) return;

        const channel = message.channel;
        const guildId = message.guild.id;

        const shopTicket = await db.get(`shop_ticket_channel_${channel.id}`);
        const auctionTicket = await db.get(`auction_ticket_channel_${channel.id}`);
        const orderTicket = await db.get(`order_ticket_channel_${channel.id}`);

        const ticketData = shopTicket || auctionTicket || orderTicket;

        if (!ticketData) {
            return message.reply("❌ هذا الروم ليس تكت مجاني.");
        }

        if (!ticketData.isFree) {
            return message.reply("❌ هذا التكت ليس مجاني.");
        }

        const ownerId = ticketData.ownerId;
        const userId = message.author.id;

        if (userId !== ownerId && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ فقط صاحب التكت أو الأدمن يمكنه الإغلاق.");
        }

        if (shopTicket) {
            await db.delete(`shop_ticket_${ownerId}_${guildId}`);
            await db.delete(`shop_ticket_channel_${channel.id}`);
        }
        if (auctionTicket) {
            await db.delete(`auction_ticket_${ownerId}_${guildId}`);
            await db.delete(`auction_ticket_channel_${channel.id}`);
            await db.delete(`auction_draft_${ownerId}_${guildId}`);
        }
        if (orderTicket) {
            await db.delete(`order_ticket_${ownerId}_${guildId}`);
            await db.delete(`order_ticket_channel_${channel.id}`);
        }

        await message.channel.send("🔒 سيتم إغلاق التكت خلال 3 ثواني...");
        setTimeout(() => channel.delete().catch(() => {}), 3000);
    });

    // ✅ إضافة جميع event listeners بشكل صحيح
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const serverColor = _ec.color(guildId);
        const linePreview = await db.get(`image_${guildId}`);

        if (interaction.customId === "shoppri") {
            const categories = interaction.guild.channels.cache.filter(
                (c) => c.type === ChannelType.GuildCategory,
            );

            if (!categories.size) {
                return interaction.reply({
                    content: `**❌ لا تـوجـد انـواع مـتـاجـر فـي هـذا الـسـيـرفـر**`,
                    ephemeral: true,
                });
            }

            const bank = await db.get(`bank_${guildId}`);
            const buyshopimage = await db.get(`buyshopimage_${guildId}`);

            const buttons = [];
            for (const [categoryId, category] of categories) {
                const categoryData = await db.get(
                    `categoryMentions_${categoryId}_${guildId}`,
                );
                if (!categoryData) continue;

                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`select_shop_price_${categoryId}`)
                        .setLabel(categoryData.nametype || "نـوع غـيـر مـحـدد")
                        .setEmoji(emojis.shop || "🛒")
                        .setStyle(ButtonStyle.Secondary),
                );
            }

            if (buttons.length === 0) {
                return interaction.reply({
                    content: "**❌ لا تـوجـد بـيـانـات مـسـجـلـة لـلأنـواع.**",
                    ephemeral: true,
                });
            }

            const row = new ActionRowBuilder().addComponents(
                buttons.slice(0, 5),
            );

            const shop_prices_embed = new EmbedBuilder()
                .setTitle(`** أسـعـار الـمـتـاجـر الـحـالـيـة **`)
                .setDescription(
                    `# - أسـعـار الـمـتـاجـر فـي ${interaction.guild.name}\n\n` +
                    `يـرجــى اخـتـيـار الـنــوع الـذي تـرغـب فــي مـعـرفــة سـعـره و مـواصــفـاتــه مـن الأزرار أدنـاه\n\n` +
                    `**الـتـحـو يـل لـحـسـاب الـبـنـك:** <@!${bank || "غـيـر مـحـدد"}>`,
                )
                .setAuthor({
                    name: interaction.guild.name,
                    iconURL: interaction.guild.iconURL({ size: 1024 }),
                })
                .setThumbnail(interaction.guild.iconURL())
                .setColor(serverColor)
                .setTimestamp();

            if (buyshopimage) shop_prices_embed.setImage(buyshopimage);
            else if (linePreview) shop_prices_embed.setImage(linePreview);

            await interaction.reply({
                embeds: [shop_prices_embed],
                components: [row],
                ephemeral: true,
            });
        }

        if (interaction.customId.startsWith("select_shop_price_")) {
            const categoryId = interaction.customId.split("_")[3];
            const categoryData = await db.get(
                `categoryMentions_${categoryId}_${guildId}`,
            );

            if (!categoryData)
                return interaction.reply({
                    content:
                        "❌ عـفـواً، لـم يـتـم الـعـثـور عـلـى بـيـانـات هـذا الـنـوع.",
                    ephemeral: true,
                });

            const {
                shopPrice: pric,
                shoprole,
                hasTax,
                taxPrice,
                everyoneMentions: evcount,
                hereMentions: hecount,
                shopmen,
                maxWarns,
                shopRoleMentions: shcount,
                nametype,
            } = categoryData;
            const shopPrice = Math.floor(pric * (20 / 19) + 1);
            const bank = await db.get(`bank_${guildId}`);
            const buyshopimage = await db.get(`buyshopimage_${guildId}`);

            if (!pric) {
                return interaction.reply({
                    content:
                        "❌ عـفـواً، لـم أسـتـطـع الـعـثـور عـلـى سـعـر لـهـذا الـنـوع.",
                    ephemeral: true,
                });
            }

            const detailEmbed = new EmbedBuilder()
                .setTitle(
                    `** تـفـاصـيـل الـنـوع: ${nametype || "غـيـر مـحـدد"} **`,
                )
                .setDescription(
                    ED.shopInteractions_002({
                        bank,
                        config,
                        evcount,
                        hasTax,
                        hecount,
                        maxWarns,
                        nametype,
                        shcount,
                        shopPrice,
                        shopmen,
                        shoprole,
                        taxPrice,
                    }),
                )
                .setColor(serverColor)
                .setTimestamp();

            if (buyshopimage) detailEmbed.setImage(buyshopimage);
            else if (linePreview) detailEmbed.setImage(linePreview);

            await interaction.reply({ embeds: [detailEmbed], ephemeral: true });
        }
    });

    // ✅ إضافة الأقواس الناقصة في النهاية
};
