// Premium Bot Manager - Secure Child Process System
const { spawn } = require('child_process');
const crypto = require('crypto');

// Store running bot processes
const runningBots = new Map();

// Encryption key for secure token storage (from env or generate)
const ENCRYPTION_KEY = process.env.PREMIUM_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Encrypt token
function encryptToken(token) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let encrypted = cipher.update(token);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt token
function decryptToken(encryptedToken) {
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// Get bot info
function getBotInfo(botId) {
    const process = runningBots.get(botId);
    if (!process) return null;
    return {
        id: botId,
        pid: process.pid,
        running: !process.killed,
        startTime: process.startTime
    };
}

// Get all running bots
function getAllRunningBots() {
    const bots = [];
    for (const [id, proc] of runningBots) {
        bots.push({
            id,
            pid: proc.pid,
            running: !proc.killed,
            startTime: proc.startTime,
            ownerId: proc.ownerId
        });
    }
    return bots;
}

// Start a premium bot with token passed via environment variable (secure)
async function startPremiumBot(botId, token, ownerId) {
    if (runningBots.has(botId) && !runningBots.get(botId).killed) {
        console.log(`[Premium] Bot ${botId} is already running`);
        return { success: false, error: 'البوت يعمل بالفعل' };
    }
    
    try {
        // Pass token securely via environment variable (not written to disk)
        const child = spawn('node', ['index-premium.js'], {
            cwd: __dirname,
            env: { 
                ...process.env,
                PREMIUM_BOT_TOKEN: token,  // Passed securely via env
                PREMIUM_BOT_ID: botId,
                PREMIUM_OWNER_ID: ownerId,
                PREMIUM_INVOICE_CODE: botId,  // Invoice code is the bot ID
                IS_PREMIUM_INSTANCE: 'true'
            },
            detached: false,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        child.startTime = new Date();
        child.botId = botId;
        child.ownerId = ownerId;
        
        child.stdout.on('data', (data) => {
            console.log(`[Premium ${botId}] ${data.toString().trim()}`);
        });
        
        child.stderr.on('data', (data) => {
            console.error(`[Premium ${botId} ERR] ${data.toString().trim()}`);
        });
        
        child.on('exit', (code, signal) => {
            console.log(`[Premium] Bot ${botId} exited (code: ${code})`);
            runningBots.delete(botId);
        });
        
        child.on('error', (err) => {
            console.error(`[Premium] Bot ${botId} error:`, err);
            runningBots.delete(botId);
        });
        
        runningBots.set(botId, child);
        console.log(`[Premium] Bot ${botId} started (PID: ${child.pid})`);
        
        return { success: true, pid: child.pid };
        
    } catch (error) {
        console.error(`[Premium] Failed to start bot ${botId}:`, error);
        return { success: false, error: error.message };
    }
}

// Stop a premium bot
function stopPremiumBot(botId) {
    const child = runningBots.get(botId);
    if (!child) {
        return { success: false, error: 'البوت غير موجود' };
    }
    
    try {
        child.kill('SIGTERM');
        runningBots.delete(botId);
        console.log(`[Premium] Bot ${botId} stopped`);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Restart a premium bot
async function restartPremiumBot(botId, token, ownerId) {
    stopPremiumBot(botId);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await startPremiumBot(botId, token, ownerId);
}

// Check if bot is running
function isBotRunning(botId) {
    const child = runningBots.get(botId);
    return child && !child.killed;
}

// Get bot uptime
function getBotUptime(botId) {
    const child = runningBots.get(botId);
    if (!child || !child.startTime) return null;
    
    const uptime = Date.now() - child.startTime.getTime();
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

module.exports = {
    startPremiumBot,
    stopPremiumBot,
    restartPremiumBot,
    isBotRunning,
    getBotInfo,
    getAllRunningBots,
    getBotUptime,
    encryptToken,
    decryptToken,
    runningBots
};
