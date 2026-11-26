/**
 * Premium Bot Template - maker_bot.js
 * هذا الملف هو قالب للبوتات البريميوم
 * كل بوت بريميوم يستخدم نسخة من هذا القالب مع توكنه الخاص
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

// قراءة إعدادات البوت من ملف خاص
const PREMIUM_CONFIG_FILE = process.env.PREMIUM_CONFIG_FILE || './premium_bot_config.json';
let premiumConfig = {};

try {
    if (fs.existsSync(PREMIUM_CONFIG_FILE)) {
        premiumConfig = JSON.parse(fs.readFileSync(PREMIUM_CONFIG_FILE, 'utf8'));
    }
} catch (e) {
    console.error('خطأ في قراءة إعدادات البريميوم:', e);
}

const ALLOWED_SERVER_ID = premiumConfig.serverId || process.env.ALLOWED_SERVER_ID;
const BOT_TOKEN = premiumConfig.token || process.env.PREMIUM_BOT_TOKEN;
const OWNER_ID = premiumConfig.ownerId || process.env.PREMIUM_OWNER_ID;
const EXPIRY_DATE = premiumConfig.expiryDate ? new Date(premiumConfig.expiryDate) : null;

if (!BOT_TOKEN) {
    console.error('❌ لم يتم تحديد توكن البوت!');
    process.exit(1);
}

if (!ALLOWED_SERVER_ID) {
    console.error('❌ لم يتم تحديد السيرفر المسموح!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// التحقق من انتهاء الاشتراك
function isExpired() {
    if (!EXPIRY_DATE) return false;
    return new Date() > EXPIRY_DATE;
}

// إرسال فاتورة انتهاء للمالك
async function sendExpiryInvoice() {
    if (!OWNER_ID) return;
    
    try {
        const owner = await client.users.fetch(OWNER_ID);
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⚠️ انتهاء اشتراك البريميوم')
            .setDescription(`
**انتهى اشتراك البوت البريميوم الخاص بك!**

**تفاصيل الاشتراك:**
• رمز الفاتورة: \`${premiumConfig.invoiceCode || 'غير متوفر'}\`
• تاريخ الانتهاء: \`${EXPIRY_DATE?.toLocaleDateString('ar-EG') || 'غير محدد'}\`
• السيرفر: \`${ALLOWED_SERVER_ID}\`

**للتجديد:**
تواصل معنا عبر سيرفر الدعم:
https://discord.gg/4czEpHmrh

**رابط دعوة البوت:**
https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands
            `)
            .setFooter({ text: 'dev by : bh.x7 & _wx10' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🔗 سيرفر الدعم')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/4czEpHmrh'),
                new ButtonBuilder()
                    .setLabel('🤖 دعوة البوت')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`)
            );
        
        await owner.send({ embeds: [embed], components: [row] });
        console.log('📧 تم إرسال فاتورة الانتهاء للمالك');
    } catch (error) {
        console.error('❌ خطأ في إرسال فاتورة الانتهاء:', error);
    }
}

client.once('ready', async () => {
    console.log(`✅ البوت البريميوم متصل: ${client.user.tag}`);
    console.log(`📍 السيرفر المسموح: ${ALLOWED_SERVER_ID}`);
    console.log(`📅 تاريخ الانتهاء: ${EXPIRY_DATE?.toLocaleDateString('ar-EG') || 'غير محدد'}`);
    
    // التحقق من الانتهاء
    if (isExpired()) {
        console.log('⚠️ الاشتراك منتهي!');
        await sendExpiryInvoice();
        
        // الخروج من جميع السيرفرات
        for (const guild of client.guilds.cache.values()) {
            try {
                await guild.leave();
                console.log(`🚪 تم الخروج من السيرفر: ${guild.name}`);
            } catch (e) {}
        }
        
        process.exit(0);
    }
    
    // التحقق من السيرفرات والخروج من غير المسموحة
    for (const guild of client.guilds.cache.values()) {
        if (guild.id !== ALLOWED_SERVER_ID) {
            try {
                await guild.leave();
                console.log(`🚪 تم الخروج من سيرفر غير مسموح: ${guild.name}`);
            } catch (e) {}
        }
    }
});

// عند الانضمام لسيرفر جديد
client.on('guildCreate', async (guild) => {
    if (guild.id !== ALLOWED_SERVER_ID) {
        console.log(`🚫 محاولة انضمام لسيرفر غير مسموح: ${guild.name}`);
        
        // إرسال رسالة قبل الخروج
        const systemChannel = guild.systemChannel;
        if (systemChannel) {
            try {
                await systemChannel.send('❌ **هذا البوت مخصص لسيرفر آخر ولا يمكنه العمل هنا.**');
            } catch (e) {}
        }
        
        await guild.leave();
    }
});

// فحص الانتهاء كل ساعة
setInterval(async () => {
    if (isExpired()) {
        console.log('⚠️ انتهى الاشتراك!');
        await sendExpiryInvoice();
        process.exit(0);
    }
}, 60 * 60 * 1000); // كل ساعة

// تسجيل الدخول
client.login(BOT_TOKEN).catch(error => {
    console.error('❌ فشل تسجيل الدخول:', error.message);
    process.exit(1);
});

console.log('🚀 جاري تشغيل البوت البريميوم...');
