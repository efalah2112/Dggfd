// Premium Bot Instance - Runs with customer's token
require('dotenv/config');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { QuickDB } = require('quick.db');

// Get config from environment (secure)
const BOT_TOKEN = process.env.PREMIUM_BOT_TOKEN;
const BOT_ID = process.env.PREMIUM_BOT_ID;
const OWNER_ID = process.env.PREMIUM_OWNER_ID;

if (!BOT_TOKEN) {
    console.error('[Premium Instance] No token provided');
    process.exit(1);
}

// Create client with essential intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

// Separate database for premium bots
const db = new QuickDB({ filePath: `premium_db_${BOT_ID}.sqlite` });

// Configuration
const config = {
    prefix: '-',
    color: '#FFD700',
    ownerId: OWNER_ID
};

// Ready event
client.once('ready', () => {
    console.log(`[Premium] ✅ Bot logged in as ${client.user.tag}`);
    console.log(`[Premium] 📊 In ${client.guilds.cache.size} servers`);
    console.log(`[Premium] 👥 Serving ${client.users.cache.size} users`);
    
    // Set activity
    client.user.setActivity(`Premium Bot | ${config.prefix}help`, { type: 3 });
});

// Message handler
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(config.prefix)) return;
    
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Help command
    if (command === 'help' || command === 'مساعدة') {
        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('📚 قائمة الأوامر')
            .setDescription(`
**🔧 أوامر الإدارة:**
\`${config.prefix}ping\` - اختبار سرعة البوت
\`${config.prefix}info\` - معلومات البوت

**🏪 أوامر المتاجر:**
\`${config.prefix}متجر\` - فتح متجر جديد
\`${config.prefix}تحويل\` - نظام التحويلات

**مالك البوت:** <@${OWNER_ID}>
            `)
            .setFooter({ text: `Premium Bot | ${BOT_ID}` })
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    // Ping command
    if (command === 'ping' || command === 'بينج') {
        const ping = client.ws.ping;
        return message.reply(`🏓 البينج: ${ping}ms`);
    }
    
    // Info command
    if (command === 'info' || command === 'معلومات') {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('ℹ️ معلومات البوت')
            .addFields(
                { name: '🤖 اسم البوت', value: client.user.tag, inline: true },
                { name: '📊 السيرفرات', value: `${client.guilds.cache.size}`, inline: true },
                { name: '👥 المستخدمين', value: `${client.users.cache.size}`, inline: true },
                { name: '⏱️ وقت التشغيل', value: `${hours}h ${minutes}m`, inline: true },
                { name: '🏓 البينج', value: `${client.ws.ping}ms`, inline: true },
                { name: '👑 المالك', value: `<@${OWNER_ID}>`, inline: true }
            )
            .setFooter({ text: `Premium Instance: ${BOT_ID}` })
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
});

// Error handling
client.on('error', (error) => {
    console.error(`[Premium ${BOT_ID}] Error:`, error);
});

process.on('uncaughtException', (error) => {
    console.error(`[Premium ${BOT_ID}] Uncaught Exception:`, error);
});

process.on('unhandledRejection', (error) => {
    console.error(`[Premium ${BOT_ID}] Unhandled Rejection:`, error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(`[Premium ${BOT_ID}] Received SIGTERM, shutting down...`);
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log(`[Premium ${BOT_ID}] Received SIGINT, shutting down...`);
    client.destroy();
    process.exit(0);
});

// Login
client.login(BOT_TOKEN).catch((error) => {
    console.error(`[Premium ${BOT_ID}] Failed to login:`, error.message);
    process.exit(1);
});
