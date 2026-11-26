const express = require('express');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || (BASE_URL ? `${BASE_URL}/auth/callback` : null);

function getRedirectUri(req) {
    if (OAUTH_REDIRECT_URI) {
        return OAUTH_REDIRECT_URI;
    }
    const host = req.get('host') || req.headers['x-forwarded-host'];
    const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    return `${protocol}://${host}/auth/callback`;
}

const sessions = new Map();
const oauthStates = new Map();

function createDashboardRoutes(app, client, db, getGuildConfig, setGuildConfig, getGuildShopTypes, setGuildShopTypes, addGuildShopType, removeGuildShopType) {

    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    function generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    function getSessionId(req) {
        return req.headers.cookie?.split(';')
            .find(c => c.trim().startsWith('session='))
            ?.split('=')[1];
    }

    function getSession(req) {
        const sessionId = getSessionId(req);
        return sessionId ? sessions.get(sessionId) : null;
    }

    async function verifyGuildAccess(accessToken, guildId) {
        try {
            const userGuildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
                headers: { authorization: `Bearer ${accessToken}` }
            });
            
            const userGuild = userGuildsResponse.data.find(g => g.id === guildId);
            if (!userGuild) return false;
            
            const hasAdmin = (parseInt(userGuild.permissions) & 0x8) === 0x8;
            const botInGuild = client.guilds.cache.has(guildId);
            
            return hasAdmin && botInGuild;
        } catch (error) {
            console.error('Error verifying guild access:', error.message);
            return false;
        }
    }

    function requireAuth(req, res, next) {
        const session = getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = session.user;
        req.accessToken = session.accessToken;
        req.userGuilds = session.userGuilds;
        next();
    }

    async function requireGuildAccess(req, res, next) {
        const { guildId } = req.params;
        
        if (!req.userGuilds) {
            const hasAccess = await verifyGuildAccess(req.accessToken, guildId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this guild' });
            }
        } else {
            const userGuild = req.userGuilds.find(g => g.id === guildId);
            if (!userGuild) {
                return res.status(403).json({ error: 'Access denied to this guild' });
            }
        }
        
        next();
    }

    function getCookieOptions() {
        const isSecure = BASE_URL?.startsWith('https') || process.env.REPLIT_DEV_DOMAIN || process.env.NODE_ENV === 'production';
        if (isSecure) {
            return `Path=/; HttpOnly; Max-Age=604800; SameSite=None; Secure`;
        }
        return `Path=/; HttpOnly; Max-Age=604800; SameSite=Lax`;
    }
    
    app.set('trust proxy', 1);

    // Handle favicon requests to prevent 404
    app.get("/favicon.ico", (req, res) => res.status(204).end());

    app.get('/', (req, res) => {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        const session = getSession(req);
        if (session) {
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        } else {
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        }
    });

    app.get('/auth/discord', (req, res) => {
        const state = crypto.randomBytes(16).toString('hex');
        const stateId = crypto.randomBytes(16).toString('hex');
        const redirectUri = getRedirectUri(req);
        
        oauthStates.set(stateId, {
            state: state,
            redirectUri: redirectUri,
            createdAt: Date.now()
        });
        
        setTimeout(() => oauthStates.delete(stateId), 10 * 60 * 1000);
        
        const isSecure = req.secure || req.get('x-forwarded-proto') === 'https' || BASE_URL?.startsWith('https');
        const cookieOptions = isSecure 
            ? `oauth_state=${stateId}; Path=/; HttpOnly; Max-Age=600; SameSite=None; Secure`
            : `oauth_state=${stateId}; Path=/; HttpOnly; Max-Age=600; SameSite=Lax`;
        res.setHeader('Set-Cookie', cookieOptions);
        console.log('Setting oauth_state cookie, secure:', isSecure);
        
        const scopes = ['identify', 'guilds', 'guilds.join'].join('%20');
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&state=${state}`;
        console.log('OAuth redirect URI:', redirectUri);
        res.redirect(authUrl);
    });

    app.get('/auth/callback', async (req, res) => {
        const { code, error, state } = req.query;
        
        if (error || !code) {
            return res.redirect('/login.html?error=auth_failed');
        }

        const stateId = req.headers.cookie?.split(';')
            .find(c => c.trim().startsWith('oauth_state='))
            ?.split('=')[1];
        
        if (!stateId) {
            return res.redirect('/login.html?error=invalid_state');
        }
        
        const storedState = oauthStates.get(stateId);
        if (!storedState || storedState.state !== state) {
            oauthStates.delete(stateId);
            return res.redirect('/login.html?error=invalid_state');
        }
        
        const redirectUri = storedState.redirectUri;
        oauthStates.delete(stateId);

        try {
            const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
                new URLSearchParams({
                    client_id: DISCORD_CLIENT_ID,
                    client_secret: DISCORD_CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: redirectUri
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            const { access_token, token_type } = tokenResponse.data;

            const [userResponse, guildsResponse] = await Promise.all([
                axios.get('https://discord.com/api/users/@me', {
                    headers: { authorization: `${token_type} ${access_token}` }
                }),
                axios.get('https://discord.com/api/users/@me/guilds', {
                    headers: { authorization: `${token_type} ${access_token}` }
                })
            ]);

            const botGuildIds = client.guilds.cache.map(g => g.id);
            const managableGuilds = guildsResponse.data.filter(guild => {
                const hasAdmin = (parseInt(guild.permissions) & 0x8) === 0x8;
                const botInGuild = botGuildIds.includes(guild.id);
                return hasAdmin && botInGuild;
            });

            // Auto-join user to support server
            const SUPPORT_SERVER_ID = '1458803521809027176';
            try {
                await axios.put(
                    `https://discord.com/api/guilds/${SUPPORT_SERVER_ID}/members/${userResponse.data.id}`,
                    { access_token: access_token },
                    { headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' } }
                );
                console.log(`✅ User ${userResponse.data.username} joined support server`);
            } catch (joinError) {
                // User may already be in server or bot lacks permissions - continue anyway
                console.log(`ℹ️ Could not join user to support server: ${joinError.response?.data?.message || joinError.message}`);
            }

            const sessionId = generateSessionId();
            sessions.set(sessionId, {
                user: userResponse.data,
                accessToken: access_token,
                tokenType: token_type,
                userGuilds: managableGuilds.map(g => ({ id: g.id, name: g.name, icon: g.icon })),
                createdAt: Date.now()
            });

            res.setHeader('Set-Cookie', [
                `session=${sessionId}; ${getCookieOptions()}`,
                'oauth_state=; Path=/; HttpOnly; Max-Age=0'
            ]);
            res.redirect('/');

        } catch (error) {
            console.error('OAuth error:', error.response?.data || error.message);
            res.redirect('/login.html?error=auth_failed');
        }
    });

    app.get('/auth/logout', (req, res) => {
        const sessionId = getSessionId(req);
        
        if (sessionId) {
            sessions.delete(sessionId);
        }
        
        res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0');
        res.redirect('/');
    });

    app.get('/api/user', requireAuth, (req, res) => {
        res.json(req.user);
    });

    app.get('/api/guilds', requireAuth, (req, res) => {
        res.json(req.userGuilds || []);
    });

    app.get('/api/guild/:guildId/config', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        try {
            const config = await getGuildConfig(guildId);
            res.json({ config });
        } catch (error) {
            console.error('Error fetching config:', error);
            res.status(500).json({ error: 'Failed to fetch config' });
        }
    });

    app.post('/api/guild/:guildId/config', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        const settings = req.body;
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        try {
            for (const [key, value] of Object.entries(settings)) {
                await setGuildConfig(guildId, key, value);
            }
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving config:', error);
            res.status(500).json({ error: 'Failed to save config' });
        }
    });

    app.get('/api/guild/:guildId/channels', requireAuth, requireGuildAccess, (req, res) => {
        const { guildId } = req.params;
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        const textChannels = guild.channels.cache
            .filter(c => c.type === 0)
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const categories = guild.channels.cache
            .filter(c => c.type === 4)
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ textChannels, categories });
    });

    app.get('/api/guild/:guildId/roles', requireAuth, requireGuildAccess, (req, res) => {
        const { guildId } = req.params;
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        const roles = guild.roles.cache
            .filter(r => r.id !== guild.id)
            .map(r => ({ 
                id: r.id, 
                name: r.name, 
                color: r.hexColor 
            }))
            .sort((a, b) => b.position - a.position);

        res.json(roles);
    });

    app.get('/api/guild/:guildId/stats', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        try {
            const shopTypes = await getGuildShopTypes(guildId);
            const customRoles = await db.get(`guildRoleTypes_${guildId}`) || [];
            const shopsList = await db.get(`shops_${guildId}`) || [];

            res.json({
                shops: shopsList.length,
                shopTypes: shopTypes.length,
                customRoles: customRoles.length,
                members: guild.memberCount
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
            res.status(500).json({ error: 'Failed to fetch stats' });
        }
    });

    app.get('/api/guild/:guildId/shop-types', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        
        try {
            const shopTypes = await getGuildShopTypes(guildId);
            res.json(shopTypes);
        } catch (error) {
            console.error('Error fetching shop types:', error);
            res.status(500).json({ error: 'Failed to fetch shop types' });
        }
    });

    app.post('/api/guild/:guildId/shop-types', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        const shopType = req.body;
        
        try {
            await addGuildShopType(guildId, shopType);
            res.json({ success: true });
        } catch (error) {
            console.error('Error adding shop type:', error);
            res.status(500).json({ error: 'Failed to add shop type' });
        }
    });

    app.put('/api/guild/:guildId/shop-types/:typeId', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId, typeId } = req.params;
        const shopType = req.body;
        
        try {
            const types = await getGuildShopTypes(guildId);
            const index = types.findIndex(t => t.id === typeId);
            
            if (index !== -1) {
                types[index] = { ...types[index], ...shopType };
                await setGuildShopTypes(guildId, types);
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Shop type not found' });
            }
        } catch (error) {
            console.error('Error updating shop type:', error);
            res.status(500).json({ error: 'Failed to update shop type' });
        }
    });

    app.delete('/api/guild/:guildId/shop-types/:typeId', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId, typeId } = req.params;
        
        try {
            await removeGuildShopType(guildId, typeId);
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting shop type:', error);
            res.status(500).json({ error: 'Failed to delete shop type' });
        }
    });

    app.get('/api/guild/:guildId/custom-roles', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        
        try {
            const customRoles = await db.get(`guildRoleTypes_${guildId}`) || [];
            res.json(customRoles);
        } catch (error) {
            console.error('Error fetching custom roles:', error);
            res.status(500).json({ error: 'Failed to fetch custom roles' });
        }
    });

    app.post('/api/guild/:guildId/custom-roles', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        const customRole = req.body;
        
        try {
            const roles = await db.get(`guildRoleTypes_${guildId}`) || [];
            roles.push(customRole);
            await db.set(`guildRoleTypes_${guildId}`, roles);
            res.json({ success: true });
        } catch (error) {
            console.error('Error adding custom role:', error);
            res.status(500).json({ error: 'Failed to add custom role' });
        }
    });

    app.put('/api/guild/:guildId/custom-roles/:roleId', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId, roleId } = req.params;
        const customRole = req.body;
        
        try {
            const roles = await db.get(`guildRoleTypes_${guildId}`) || [];
            const index = roles.findIndex(r => r.id === roleId);
            
            if (index !== -1) {
                roles[index] = { ...roles[index], ...customRole };
                await db.set(`guildRoleTypes_${guildId}`, roles);
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Custom role not found' });
            }
        } catch (error) {
            console.error('Error updating custom role:', error);
            res.status(500).json({ error: 'Failed to update custom role' });
        }
    });

    app.delete('/api/guild/:guildId/custom-roles/:roleId', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId, roleId } = req.params;
        
        try {
            const roles = await db.get(`guildRoleTypes_${guildId}`) || [];
            const newRoles = roles.filter(r => r.id !== roleId);
            await db.set(`guildRoleTypes_${guildId}`, newRoles);
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting custom role:', error);
            res.status(500).json({ error: 'Failed to delete custom role' });
        }
    });

    // ==================== Premium System API ====================
    const fs = require('fs');
    
    function getDevelopersData() {
        try {
            return JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
        } catch {
            return { developers: [], blacklist: { users: [], servers: [] }, premiumBots: [], stats: { totalPremiumSold: 0, totalRevenue: 0, activeBots: 0 } };
        }
    }
    
    function saveDevelopersData(data) {
        fs.writeFileSync('./developers.json', JSON.stringify(data, null, 2));
    }
    
    function isDeveloperUser(userId) {
        const data = getDevelopersData();
        return data.developers.includes(userId);
    }

    app.get('/api/premium/is-developer', requireAuth, (req, res) => {
        const isDev = isDeveloperUser(req.user.id);
        res.json({ isDeveloper: isDev });
    });

    app.get('/api/premium/stats', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const data = getDevelopersData();
        res.json({
            stats: data.stats,
            developersCount: data.developers.length,
            blacklistUsers: data.blacklist.users.length,
            blacklistServers: data.blacklist.servers.length
        });
    });

    app.get('/api/premium/bots', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const data = getDevelopersData();
        res.json(data.premiumBots.map(bot => ({
            id: bot.id, userId: bot.userId, serverId: bot.serverId,
            status: bot.status, createdAt: bot.createdAt,
            expiryDate: bot.expiryDate, invoiceCode: bot.invoiceCode
        })));
    });

    app.get('/api/premium/my-bots', requireAuth, (req, res) => {
        const data = getDevelopersData();
        const myBots = data.premiumBots.filter(bot => bot.userId === req.user.id && bot.status === 'active');
        res.json(myBots.map(bot => ({
            id: bot.id, serverId: bot.serverId, status: bot.status,
            expiryDate: bot.expiryDate, invoiceCode: bot.invoiceCode
        })));
    });

    app.get('/api/premium/blacklist', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        res.json(getDevelopersData().blacklist);
    });

    app.post('/api/premium/blacklist', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        const { type, id } = req.body;
        const data = getDevelopersData();
        if (type === 'user' && !data.blacklist.users.includes(id)) {
            data.blacklist.users.push(id);
            saveDevelopersData(data);
            res.json({ success: true });
        } else if (type === 'server' && !data.blacklist.servers.includes(id)) {
            data.blacklist.servers.push(id);
            saveDevelopersData(data);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Already in blacklist' });
        }
    });

    app.delete('/api/premium/blacklist/:type/:id', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        const { type, id } = req.params;
        const data = getDevelopersData();
        if (type === 'user') data.blacklist.users = data.blacklist.users.filter(u => u !== id);
        else if (type === 'server') data.blacklist.servers = data.blacklist.servers.filter(s => s !== id);
        saveDevelopersData(data);
        res.json({ success: true });
    });

    app.post('/api/premium/add-bot', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        const { userId, serverId } = req.body;
        if (!userId || !serverId) return res.status(400).json({ error: 'userId and serverId required' });
        if (!/^\d{17,19}$/.test(serverId)) return res.status(400).json({ error: 'Invalid server ID' });
        
        const data = getDevelopersData();
        if (data.blacklist.users.includes(userId) || data.blacklist.servers.includes(serverId)) {
            return res.status(400).json({ error: 'Blacklisted' });
        }
        if (data.premiumBots.find(b => b.userId === userId && b.serverId === serverId && b.status === 'active')) {
            return res.status(400).json({ error: 'Already has active premium' });
        }
        
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        const newBot = {
            id: `PREM-${Date.now()}`,
            userId, botToken: 'TOKEN_MANAGED_EXTERNALLY', serverId,
            createdAt: new Date().toISOString(),
            expiryDate: expiryDate.toISOString(),
            invoiceCode: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            status: 'active'
        };
        data.premiumBots.push(newBot);
        data.stats.totalPremiumSold++;
        data.stats.activeBots++;
        saveDevelopersData(data);
        res.json({ success: true, bot: { ...newBot, botToken: undefined } });
    });

    app.get('/api/premium/developers', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        res.json(getDevelopersData().developers);
    });

    // ============ إعدادات البريميوم ============
    app.get('/api/premium/settings', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        try {
            const makerData = JSON.parse(require('fs').readFileSync('./makerdb.json', 'utf8'));
            res.json(makerData.settings);
        } catch {
            res.json({ premiumPrice: 5000, transferBank: null });
        }
    });

    app.post('/api/premium/settings', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        try {
            const fs = require('fs');
            const makerData = JSON.parse(fs.readFileSync('./makerdb.json', 'utf8'));
            const { premiumPrice, transferBank } = req.body;
            if (premiumPrice !== undefined) makerData.settings.premiumPrice = parseInt(premiumPrice);
            if (transferBank !== undefined) makerData.settings.transferBank = transferBank;
            fs.writeFileSync('./makerdb.json', JSON.stringify(makerData, null, 2));
            res.json({ success: true, settings: makerData.settings });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update settings' });
        }
    });

    app.get('/api/premium/maker-stats', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        try {
            const makerData = JSON.parse(require('fs').readFileSync('./makerdb.json', 'utf8'));
            res.json(makerData.stats);
        } catch {
            res.json({ totalSold: 0, totalRevenue: 0, activeBots: 0 });
        }
    });

    app.post('/api/premium/developers', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        const { userId } = req.body;
        const data = getDevelopersData();
        if (!data.developers.includes(userId)) {
            data.developers.push(userId);
            saveDevelopersData(data);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Already developer' });
        }
    });

    // ============ Shops Management API ============
    app.get('/api/guild/:guildId/shops', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const shopsList = await db.get(`shops_${guildId}`) || [];
            const shops = [];
            for (const channelId of shopsList) {
                const shop = await db.get(`shop_${channelId}`);
                if (shop) {
                    const channel = client.channels.cache.get(channelId);
                    shops.push({
                        channelId,
                        name: channel?.name || shop.name || 'بدون اسم',
                        type: shop.type || 'غير محدد',
                        ownerId: shop.ownerId,
                        ownerName: shop.ownerName,
                        partners: shop.partners || [],
                        taxPaid: shop.taxPaid || false,
                        taxAmount: shop.tax || 0
                    });
                }
            }
            res.json(shops);
        } catch (error) {
            console.error('Error fetching shops:', error);
            res.status(500).json({ error: 'Failed to fetch shops' });
        }
    });

    app.get('/api/guild/:guildId/shops/:channelId', requireAuth, requireGuildAccess, async (req, res) => {
        const { channelId } = req.params;
        try {
            const shop = await db.get(`shop_${channelId}`);
            if (shop) {
                res.json(shop);
            } else {
                res.status(404).json({ error: 'Shop not found' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch shop' });
        }
    });

    app.delete('/api/guild/:guildId/shops/:channelId', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId, channelId } = req.params;
        try {
            await db.delete(`shop_${channelId}`);
            const shopsList = await db.get(`shops_${guildId}`) || [];
            const newList = shopsList.filter(id => id !== channelId);
            await db.set(`shops_${guildId}`, newList);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete shop' });
        }
    });

    // ============ Tax System API ============
    app.get('/api/guild/:guildId/tax-settings', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const taxSettings = await db.get(`taxSettings_${guildId}`) || {};
            res.json(taxSettings);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch tax settings' });
        }
    });

    app.post('/api/guild/:guildId/tax-settings', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            await db.set(`taxSettings_${guildId}`, req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save tax settings' });
        }
    });

    app.post('/api/guild/:guildId/publish-taxes', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const shopsList = await db.get(`shops_${guildId}`) || [];
            const taxSettings = await db.get(`taxSettings_${guildId}`) || {};
            let sentCount = 0;
            
            for (const channelId of shopsList) {
                const channel = client.channels.cache.get(channelId);
                if (channel) {
                    const shop = await db.get(`shop_${channelId}`);
                    const tax = taxSettings.typeTaxes?.[shop?.type] || shop?.tax || 0;
                    try {
                        await channel.send(`📋 **إشعار ضريبة**\nالمبلغ المطلوب: \`${tax}\` كردت`);
                        sentCount++;
                    } catch (e) {}
                }
            }
            res.json({ success: true, sentCount });
        } catch (error) {
            res.status(500).json({ error: 'Failed to publish taxes' });
        }
    });

    // ============ Financial Stats API ============
    app.get('/api/guild/:guildId/financial-stats', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const shopsList = await db.get(`shops_${guildId}`) || [];
            const paidShops = [];
            const unpaidShops = [];
            let totalRevenue = 0;
            
            for (const channelId of shopsList) {
                const shop = await db.get(`shop_${channelId}`);
                if (shop) {
                    const channel = client.channels.cache.get(channelId);
                    const shopData = {
                        channelId,
                        name: channel?.name || shop.name || 'بدون اسم',
                        ownerId: shop.ownerId,
                        ownerName: shop.ownerName,
                        taxAmount: shop.tax || 0,
                        lastPayDate: shop.lastPayDate || null
                    };
                    if (shop.taxPaid) {
                        paidShops.push(shopData);
                        totalRevenue += shop.tax || 0;
                    } else {
                        unpaidShops.push(shopData);
                    }
                }
            }
            
            res.json({
                paidCount: paidShops.length,
                unpaidCount: unpaidShops.length,
                totalRevenue,
                paidShops,
                unpaidShops
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch financial stats' });
        }
    });

    // ============ Mass Message API ============
    app.post('/api/guild/:guildId/mass-message', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        const { types, title, content, color, category } = req.body;
        
        try {
            const shopsList = await db.get(`shops_${guildId}`) || [];
            let sentCount = 0;
            
            for (const channelId of shopsList) {
                const shop = await db.get(`shop_${channelId}`);
                if (shop && types.includes(shop.type)) {
                    const channel = client.channels.cache.get(channelId);
                    if (channel && (!category || channel.parentId === category)) {
                        try {
                            const { EmbedBuilder } = require('discord.js');
                            const embed = new EmbedBuilder()
                                .setColor(color || '#5865F2')
                                .setTitle(title)
                                .setDescription(content)
                                .setFooter({ text: 'dev by : bh.x7 & _wx10' });
                            await channel.send({ embeds: [embed] });
                            sentCount++;
                        } catch (e) {}
                    }
                }
            }
            res.json({ success: true, sentCount });
        } catch (error) {
            res.status(500).json({ error: 'Failed to send mass message' });
        }
    });

    // ============ Embed Settings API ============
    app.get('/api/guild/:guildId/embeds', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const embeds = await db.get(`embeds_${guildId}`) || [];
            res.json(embeds);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch embeds' });
        }
    });

    app.post('/api/guild/:guildId/embeds', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const embeds = await db.get(`embeds_${guildId}`) || [];
            const existing = embeds.findIndex(e => e.name === req.body.name);
            if (existing !== -1) {
                embeds[existing] = req.body;
            } else {
                embeds.push(req.body);
            }
            await db.set(`embeds_${guildId}`, embeds);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save embed' });
        }
    });

    app.delete('/api/guild/:guildId/embeds/:name', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId, name } = req.params;
        try {
            const embeds = await db.get(`embeds_${guildId}`) || [];
            const newEmbeds = embeds.filter(e => e.name !== decodeURIComponent(name));
            await db.set(`embeds_${guildId}`, newEmbeds);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete embed' });
        }
    });

    // ============ Suggestions Settings API ============
    app.get('/api/guild/:guildId/suggestion-settings', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const settings = await db.get(`suggestionSettings_${guildId}`) || {};
            res.json(settings);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch suggestion settings' });
        }
    });

    app.post('/api/guild/:guildId/suggestion-settings', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            await db.set(`suggestionSettings_${guildId}`, req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save suggestion settings' });
        }
    });

    // ============ Prices Configuration API ============
    // الأسعار المنفصلة لكل قسم
    const defaultPrices = {
        shops: { basic: 0, premium: 0, vip: 0 },
        auctions: { fee: 0, minBid: 0 },
        orders: { basic: 0, express: 0 },
        roles: { mention: 0, custom: 0 },
        tickets: { support: 0, priority: 0 }
    };

    app.get('/api/guild/:guildId/prices', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const prices = await db.get(`pricesConfig_${guildId}`) || defaultPrices;
            res.json(prices);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch prices' });
        }
    });

    app.post('/api/guild/:guildId/prices', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const currentPrices = await db.get(`pricesConfig_${guildId}`) || defaultPrices;
            const updatedPrices = { ...currentPrices, ...req.body };
            await db.set(`pricesConfig_${guildId}`, updatedPrices);
            res.json({ success: true, prices: updatedPrices });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save prices' });
        }
    });

    // ============ Rules Configuration API ============
    // القوانين المنفصلة لكل قسم
    const defaultRules = {
        shops: '',
        auctions: '',
        orders: '',
        roles: '',
        tickets: '',
        general: ''
    };

    app.get('/api/guild/:guildId/rules', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const rules = await db.get(`rulesConfig_${guildId}`) || defaultRules;
            res.json(rules);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch rules' });
        }
    });

    app.post('/api/guild/:guildId/rules', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const currentRules = await db.get(`rulesConfig_${guildId}`) || defaultRules;
            const updatedRules = { ...currentRules, ...req.body };
            await db.set(`rulesConfig_${guildId}`, updatedRules);
            res.json({ success: true, rules: updatedRules });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save rules' });
        }
    });

    // ============ Laws Embeds API (for !قوانين command) ============
    app.get('/api/guild/:guildId/laws-embeds', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        try {
            const gConfig = await getGuildConfig(guildId);
            const lawsEmbeds = {
                shops: {
                    title: gConfig.shopRulesTitle || 'قوانين المتاجر',
                    description: gConfig.shopRulesDescription || '',
                    image: gConfig.shopRulesImage || '',
                    footer: gConfig.shopRulesFooter || ''
                },
                auctions: {
                    title: gConfig.auctionRulesTitle || 'قوانين المزاد',
                    description: gConfig.auctionRulesDescription || '',
                    image: gConfig.auctionRulesImage || '',
                    footer: gConfig.auctionRulesFooter || ''
                },
                orders: {
                    title: gConfig.orderRulesTitle || 'قوانين الطلبات',
                    description: gConfig.orderRulesDescription || '',
                    image: gConfig.orderRulesImage || '',
                    footer: gConfig.orderRulesFooter || ''
                },
                general: {
                    title: gConfig.generalRulesTitle || 'القوانين العامة',
                    description: gConfig.generalRulesDescription || '',
                    image: gConfig.generalRulesImage || '',
                    footer: gConfig.generalRulesFooter || ''
                },
                ads: {
                    title: gConfig.adsRulesTitle || 'قوانين الإعلان والبارتنر',
                    description: gConfig.adsRulesDescription || '',
                    image: gConfig.adsRulesImage || '',
                    footer: gConfig.adsRulesFooter || ''
                },
                exchange: {
                    title: gConfig.exchangeRulesTitle || 'قوانين التبادل',
                    description: gConfig.exchangeRulesDescription || '',
                    image: gConfig.exchangeRulesImage || '',
                    footer: gConfig.exchangeRulesFooter || ''
                },
                main: {
                    title: gConfig.mainLawsTitle || 'تنظيم قوانين السيرفر',
                    description: gConfig.mainLawsDescription || 'الرجاء اختيار القوانين التي تريدها بالاسفل',
                    image: gConfig.mainLawsImage || '',
                    color: gConfig.lawsColor || gConfig.color || '#051678'
                }
            };
            res.json(lawsEmbeds);
        } catch (error) {
            console.error('Error fetching laws embeds:', error);
            res.status(500).json({ error: 'Failed to fetch laws embeds' });
        }
    });

    app.post('/api/guild/:guildId/laws-embeds', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId } = req.params;
        const { type, title, description, image, footer, color } = req.body;
        
        try {
            const fieldMap = {
                shops: { title: 'shopRulesTitle', description: 'shopRulesDescription', image: 'shopRulesImage', footer: 'shopRulesFooter' },
                auctions: { title: 'auctionRulesTitle', description: 'auctionRulesDescription', image: 'auctionRulesImage', footer: 'auctionRulesFooter' },
                orders: { title: 'orderRulesTitle', description: 'orderRulesDescription', image: 'orderRulesImage', footer: 'orderRulesFooter' },
                general: { title: 'generalRulesTitle', description: 'generalRulesDescription', image: 'generalRulesImage', footer: 'generalRulesFooter' },
                ads: { title: 'adsRulesTitle', description: 'adsRulesDescription', image: 'adsRulesImage', footer: 'adsRulesFooter' },
                exchange: { title: 'exchangeRulesTitle', description: 'exchangeRulesDescription', image: 'exchangeRulesImage', footer: 'exchangeRulesFooter' },
                main: { title: 'mainLawsTitle', description: 'mainLawsDescription', image: 'mainLawsImage', color: 'lawsColor' }
            };
            
            const fields = fieldMap[type];
            if (!fields) {
                return res.status(400).json({ error: 'Invalid type' });
            }
            
            if (title !== undefined) await setGuildConfig(guildId, fields.title, title);
            if (description !== undefined) await setGuildConfig(guildId, fields.description, description);
            if (image !== undefined) await setGuildConfig(guildId, fields.image, image);
            if (footer !== undefined && fields.footer) await setGuildConfig(guildId, fields.footer, footer);
            if (color !== undefined && fields.color) await setGuildConfig(guildId, fields.color, color);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving laws embed:', error);
            res.status(500).json({ error: 'Failed to save laws embed' });
        }
    });

    // ============ Website Tickets API ============
    app.get('/api/website-tickets/my', requireAuth, async (req, res) => {
        try {
            const allTickets = await db.get('websiteTickets') || [];
            const myTickets = allTickets.filter(t => t.userId === req.user.id);
            res.json(myTickets);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch tickets' });
        }
    });

    app.get('/api/website-tickets/:id', requireAuth, async (req, res) => {
        try {
            const allTickets = await db.get('websiteTickets') || [];
            const ticket = allTickets.find(t => t.id === req.params.id);
            if (ticket && (ticket.userId === req.user.id || isDeveloperUser(req.user.id))) {
                res.json(ticket);
            } else {
                res.status(404).json({ error: 'Ticket not found' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch ticket' });
        }
    });

    app.post('/api/website-tickets', requireAuth, async (req, res) => {
        const { subject, description } = req.body;
        try {
            const allTickets = await db.get('websiteTickets') || [];
            const newTicket = {
                id: `TKT-${Date.now()}`,
                userId: req.user.id,
                userName: req.user.username,
                subject,
                description,
                status: 'open',
                createdAt: new Date().toISOString(),
                replies: []
            };
            allTickets.push(newTicket);
            await db.set('websiteTickets', allTickets);
            
            // Send to developers channel if configured
            const devChannel = client.channels.cache.get('1299339997744463990');
            if (devChannel) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('📩 تذكرة جديدة من الموقع')
                    .setDescription(`**من:** ${req.user.username}\n**الموضوع:** ${subject}\n\n${description}`)
                    .setFooter({ text: `ID: ${newTicket.id}` })
                    .setTimestamp();
                await devChannel.send({ embeds: [embed] });
            }
            
            res.json({ success: true, ticket: newTicket });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create ticket' });
        }
    });

    setInterval(() => {
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        for (const [sessionId, session] of sessions.entries()) {
            if (now - session.createdAt > maxAge) {
                sessions.delete(sessionId);
            }
        }
    }, 60 * 60 * 1000);

    console.log('📋 Dashboard Configuration:');
    console.log(`   BASE_URL: ${BASE_URL || '(auto-detect from request)'}`);
    console.log(`   OAuth Redirect: ${OAUTH_REDIRECT_URI || '(auto-detect from request)'}`);


    // System Logs API
    app.get('/api/guild/:guildId/logs', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const { type = 'all' } = req.query;
            
            const logs = await db.get(`logs_${guildId}`) || [];
            let filteredLogs = logs;
            
            if (type !== 'all') {
                filteredLogs = logs.filter(log => log.type === type);
            }
            
            const stats = {
                total: logs.length,
                login: logs.filter(l => l.type === 'login').length,
                failed: logs.filter(l => l.type === 'failed').length,
                settings: logs.filter(l => l.type === 'settings').length,
                shops: logs.filter(l => l.type === 'shops').length,
                errors: logs.filter(l => l.type === 'errors').length
            };
            
            res.json({ logs: filteredLogs.slice(-100).reverse(), stats });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch logs' });
        }
    });
    
    app.delete('/api/guild/:guildId/logs', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            await db.set(`logs_${guildId}`, []);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear logs' });
        }
    });
    
    // Send Ticket Embed API
    app.post('/api/guild/:guildId/send-ticket-embed', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const { type, roomId } = req.body;
            
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(404).json({ error: 'Server not found' });
            
            const channel = guild.channels.cache.get(roomId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });
            
            const gConfig = await getGuildConfig(guildId);
            const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
            
            let embed, button;
            
            if (type === 'buy') {
                embed = new EmbedBuilder()
                    .setTitle('🛒 تكت البيع والشراء')
                    .setDescription('اضغط على الزر بالأسفل لفتح تكت')
                    .setColor(gConfig.color || '#5865F2');
                button = new ButtonBuilder()
                    .setCustomId('open_buy_ticket')
                    .setLabel('فتح تكت')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫');
            } else if (type === 'auction') {
                embed = new EmbedBuilder()
                    .setTitle(gConfig.auctionEmbedTitle || '🔨 شراء مزاد')
                    .setDescription(gConfig.auctionEmbedDesc || 'اضغط على الزر بالأسفل لفتح تكت شراء مزاد')
                    .setColor(gConfig.color || '#5865F2');
                button = new ButtonBuilder()
                    .setCustomId('open_auction_ticket')
                    .setLabel(gConfig.auctionButtonText || 'فتح تكت مزاد')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔨');
            } else if (type === 'order') {
                embed = new EmbedBuilder()
                    .setTitle(gConfig.orderEmbedTitle || '📝 شراء طلب')
                    .setDescription(gConfig.orderEmbedDesc || 'اضغط على الزر بالأسفل لفتح تكت شراء طلب')
                    .setColor(gConfig.color || '#5865F2');
                button = new ButtonBuilder()
                    .setCustomId('open_order_ticket')
                    .setLabel(gConfig.orderButtonText || 'فتح تكت طلب')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝');
            }
            
            const row = new ActionRowBuilder().addComponents(button);
            await channel.send({ embeds: [embed], components: [row] });
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error sending ticket embed:', error);
            res.status(500).json({ error: 'Failed to send embed' });
        }
    });

    // Get single embed by ID or name
    app.get('/api/guild/:guildId/embeds/:embedId', requireAuth, requireGuildAccess, async (req, res) => {
        const { guildId, embedId } = req.params;
        try {
            const embeds = await db.get(`embeds_${guildId}`) || [];
            const embed = embeds.find(e => e.id === embedId || e.name === embedId);
            if (!embed) return res.status(404).json({ error: 'Embed not found' });
            res.json(embed);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch embed' });
        }
    });

    // Send embed to a channel
    app.post('/api/guild/:guildId/send-embed', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const { channelId, messageContent, color, authorName, authorUrl, title, description, image, thumbnail, footer, fields } = req.body;
            
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(404).json({ error: 'Server not found' });
            
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });
            
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder().setColor(color || '#5865F2');
            
            if (authorName) embed.setAuthor({ name: authorName, iconURL: authorUrl || undefined });
            if (title) embed.setTitle(title);
            if (description) embed.setDescription(description);
            if (image) embed.setImage(image);
            if (thumbnail) embed.setThumbnail(thumbnail);
            if (footer) embed.setFooter({ text: footer });
            if (fields && fields.length > 0) {
                fields.forEach(field => {
                    if (field.name && field.value) {
                        embed.addFields({ name: field.name, value: field.value, inline: field.inline || false });
                    }
                });
            }
            
            const sendOptions = {};
            if (messageContent) sendOptions.content = messageContent;
            if (title || description) sendOptions.embeds = [embed];
            
            await channel.send(sendOptions);
            res.json({ success: true });
        } catch (error) {
            console.error('Error sending embed:', error);
            res.status(500).json({ error: 'Failed to send embed' });
        }
    });


    // ========================
    // Auto Reply API (Stored in Database)
    // ========================
    app.get('/api/guild/:guildId/auto-replies', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const replies = await db.get(`autoReplies_${guildId}`) || [];
            res.json(replies);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch auto replies' });
        }
    });

    app.get('/api/guild/:guildId/auto-replies/:replyId', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId, replyId } = req.params;
            const replies = await db.get(`autoReplies_${guildId}`) || [];
            const reply = replies.find(r => r.id === replyId);
            if (!reply) return res.status(404).json({ error: 'Reply not found' });
            res.json(reply);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch reply' });
        }
    });

    app.post('/api/guild/:guildId/auto-replies', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const replyData = req.body;
            let replies = await db.get(`autoReplies_${guildId}`) || [];
            
            const existingIndex = replies.findIndex(r => r.id === replyData.id);
            if (existingIndex >= 0) {
                replies[existingIndex] = replyData;
            } else {
                replies.push(replyData);
            }
            
            await db.set(`autoReplies_${guildId}`, replies);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save reply' });
        }
    });

    app.delete('/api/guild/:guildId/auto-replies/:replyId', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId, replyId } = req.params;
            let replies = await db.get(`autoReplies_${guildId}`) || [];
            replies = replies.filter(r => r.id !== replyId);
            await db.set(`autoReplies_${guildId}`, replies);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete reply' });
        }
    });

    // ========================
    // Auto Line API (Stored in Database)
    // ========================
    app.get('/api/guild/:guildId/auto-line', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const settings = await db.get(`autoLine_${guildId}`) || {};
            res.json(settings);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch settings' });
        }
    });

    app.post('/api/guild/:guildId/auto-line', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            await db.set(`autoLine_${guildId}`, req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save settings' });
        }
    });

    // ========================
    // Tax Room API (Stored in Database)
    // ========================
    app.get('/api/guild/:guildId/tax-room', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const settings = await db.get(`taxRoom_${guildId}`) || {};
            res.json(settings);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch settings' });
        }
    });

    app.post('/api/guild/:guildId/tax-room', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            await db.set(`taxRoom_${guildId}`, req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save settings' });
        }
    });

    // ========================
    // Reminder System API - نظام التذكيرات
    // ========================
    app.get('/api/guild/:guildId/reminder-settings', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const settings = await db.get(`reminderSettings_${guildId}`) || {
                enabled: true,
                autoReminder: false,
                reminderInterval: 24,
                reminderMessage: '📢 **تذكير دفع الضريبة**\n\nيرجى دفع الضريبة المستحقة.',
                reminderEmbed: {
                    title: 'تذكير الضريبة',
                    color: '#FF6B6B',
                    description: 'يرجى دفع الضريبة المستحقة في أقرب وقت.'
                }
            };
            res.json(settings);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch reminder settings' });
        }
    });

    app.post('/api/guild/:guildId/reminder-settings', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            await db.set(`reminderSettings_${guildId}`, req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save reminder settings' });
        }
    });

    app.post('/api/guild/:guildId/send-reminders', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Guild not found' });
            }
            
            const settings = await db.get(`reminderSettings_${guildId}`) || {};
            const shopsList = await db.get(`shops_${guildId}`) || [];
            let sentCount = 0;
            
            for (const channelId of shopsList) {
                const channel = client.channels.cache.get(channelId);
                if (channel) {
                    try {
                        const shop = await db.get(`shop_${channelId}`);
                        const message = settings.reminderMessage || '📢 **تذكير دفع الضريبة**';
                        await channel.send(message);
                        sentCount++;
                    } catch (e) {
                        console.log('Could not send to channel:', channelId);
                    }
                }
            }
            
            res.json({ success: true, sentCount });
        } catch (error) {
            res.status(500).json({ error: 'Failed to send reminders' });
        }
    });

    // ========================
    // Ticket Embeds API - تخصيص إيمبدات التكتات
    // ========================
    app.get('/api/guild/:guildId/ticket-embeds', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            const embeds = await db.get(`ticketEmbeds_${guildId}`) || {};
            res.json(embeds);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch ticket embeds' });
        }
    });

    app.post('/api/guild/:guildId/ticket-embeds', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId } = req.params;
            await db.set(`ticketEmbeds_${guildId}`, req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save ticket embeds' });
        }
    });

    app.get('/api/guild/:guildId/ticket-embeds/:ticketType', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId, ticketType } = req.params;
            const embeds = await db.get(`ticketEmbeds_${guildId}`) || {};
            res.json(embeds[ticketType] || {});
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch ticket embed' });
        }
    });

    app.post('/api/guild/:guildId/ticket-embeds/:ticketType', requireAuth, requireGuildAccess, async (req, res) => {
        try {
            const { guildId, ticketType } = req.params;
            const embeds = await db.get(`ticketEmbeds_${guildId}`) || {};
            embeds[ticketType] = req.body;
            await db.set(`ticketEmbeds_${guildId}`, embeds);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save ticket embed' });
        }
    });

    // ========================
    // Developer Backup API - النسخ الاحتياطي للمطورين
    // ========================
    const archiver = require('archiver');
    
    app.post('/api/developer/backup', requireAuth, async (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const { targetUserId } = req.body;
            // Security: Only allow sending to self or other developers
            const devData = getDevelopersData();
            if (targetUserId && targetUserId !== req.user.id && !devData.developers.includes(targetUserId)) {
                return res.status(403).json({ error: 'Can only send backups to developers' });
            }
            const userId = targetUserId || req.user.id;
            
            const user = await client.users.fetch(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const backupDir = './backups';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `backup_${timestamp}.zip`;
            const backupPath = `${backupDir}/${backupFileName}`;
            
            if (!require('fs').existsSync(backupDir)) {
                require('fs').mkdirSync(backupDir, { recursive: true });
            }
            
            const output = require('fs').createWriteStream(backupPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            output.on('close', async () => {
                try {
                    const { AttachmentBuilder } = require('discord.js');
                    const attachment = new AttachmentBuilder(backupPath, { name: backupFileName });
                    
                    await user.send({
                        content: `📦 **نسخة احتياطية**\n📅 التاريخ: ${new Date().toLocaleString('ar-SA')}\n📁 الحجم: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`,
                        files: [attachment]
                    });
                    
                    res.json({ success: true, message: 'Backup sent to DM', size: archive.pointer() });
                } catch (dmError) {
                    console.error('Failed to send backup DM:', dmError);
                    res.status(500).json({ error: 'Failed to send DM. Make sure DMs are enabled.' });
                }
            });
            
            archive.on('error', (err) => {
                throw err;
            });
            
            archive.pipe(output);
            
            archive.file('quickdb.json', { name: 'quickdb.json' });
            archive.file('developers.json', { name: 'developers.json' });
            archive.file('config.json', { name: 'config.json' });
            archive.file('makerdb.json', { name: 'makerdb.json' });
            
            await archive.finalize();
            
        } catch (error) {
            console.error('Backup error:', error);
            res.status(500).json({ error: 'Failed to create backup' });
        }
    });

    app.get('/api/developer/backup-list', requireAuth, async (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const fs = require('fs');
            const backupDir = './backups';
            
            if (!fs.existsSync(backupDir)) {
                return res.json([]);
            }
            
            const files = fs.readdirSync(backupDir)
                .filter(f => f.endsWith('.zip'))
                .map(f => ({
                    name: f,
                    size: fs.statSync(`${backupDir}/${f}`).size,
                    date: fs.statSync(`${backupDir}/${f}`).mtime
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            
            res.json(files);
        } catch (error) {
            res.status(500).json({ error: 'Failed to list backups' });
        }
    });

    // ============ Premium Bot Management API (Developer) ============
    const premiumManager = require('./premium-bot-manager');
    
    // Get all premium bots (developer only)
    app.get('/api/developer/premium-bots', requireAuth, async (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const fs = require('fs');
            const devData = JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
            const premiumBots = devData.premiumBots || [];
            
            // Add running status to each bot
            const botsWithStatus = premiumBots.map(bot => ({
                ...bot,
                isRunning: premiumManager.isBotRunning(bot.invoiceCode),
                uptime: premiumManager.getBotUptime(bot.invoiceCode)
            }));
            
            res.json(botsWithStatus);
        } catch (error) {
            console.error('Error fetching premium bots:', error);
            res.status(500).json({ error: 'Failed to fetch premium bots' });
        }
    });
    
    // Get running premium bots (developer only)
    app.get('/api/developer/premium-bots/running', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const runningBots = premiumManager.getAllRunningBots();
        res.json(runningBots);
    });
    
    // Start a premium bot (developer only)
    app.post('/api/developer/premium-bots/:invoiceCode/start', requireAuth, async (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const { invoiceCode } = req.params;
            const fs = require('fs');
            const devData = JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
            const bot = (devData.premiumBots || []).find(b => b.invoiceCode === invoiceCode);
            
            if (!bot) {
                return res.status(404).json({ error: 'Bot not found' });
            }
            
            if (!bot.token) {
                // For monthly subscriptions without token, we can't start automatically
                // Return meaningful error message
                return res.status(400).json({ 
                    error: 'لا يوجد توكن لهذا البوت. البوتات الشهرية تستخدم التوكن الرئيسي فقط.',
                    needsToken: true 
                });
            }
            
            // Decrypt token
            const decryptedToken = premiumManager.decryptToken(bot.token);
            const result = await premiumManager.startPremiumBot(invoiceCode, decryptedToken, bot.userId);
            
            res.json(result);
        } catch (error) {
            console.error('Error starting bot:', error);
            res.status(500).json({ error: 'Failed to start bot' });
        }
    });
    
    // Stop a premium bot (developer only)
    app.post('/api/developer/premium-bots/:invoiceCode/stop', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const { invoiceCode } = req.params;
        const result = premiumManager.stopPremiumBot(invoiceCode);
        res.json(result);
    });
    
    // Restart a premium bot (developer only)
    app.post('/api/developer/premium-bots/:invoiceCode/restart', requireAuth, async (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const { invoiceCode } = req.params;
            const fs = require('fs');
            const devData = JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
            const bot = (devData.premiumBots || []).find(b => b.invoiceCode === invoiceCode);
            
            if (!bot || !bot.token) {
                return res.status(404).json({ error: 'Bot or token not found' });
            }
            
            const decryptedToken = premiumManager.decryptToken(bot.token);
            const result = await premiumManager.restartPremiumBot(invoiceCode, decryptedToken, bot.userId);
            
            res.json(result);
        } catch (error) {
            console.error('Error restarting bot:', error);
            res.status(500).json({ error: 'Failed to restart bot' });
        }
    });
    
    // Delete premium bot (developer only)
    app.delete('/api/developer/premium-bots/:invoiceCode', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const { invoiceCode } = req.params;
            const fs = require('fs');
            const devData = JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
            
            // Stop the bot if running
            premiumManager.stopPremiumBot(invoiceCode);
            
            // Remove from list
            devData.premiumBots = (devData.premiumBots || []).filter(b => b.invoiceCode !== invoiceCode);
            fs.writeFileSync('./developers.json', JSON.stringify(devData, null, 2));
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting bot:', error);
            res.status(500).json({ error: 'Failed to delete bot' });
        }
    });
    
    // Update premium bot subscription (developer only)
    app.patch('/api/developer/premium-bots/:invoiceCode', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const { invoiceCode } = req.params;
            const { expiryDate, status, serverId, userId } = req.body;
            const fs = require('fs');
            const devData = JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
            
            const botIndex = (devData.premiumBots || []).findIndex(b => b.invoiceCode === invoiceCode);
            if (botIndex === -1) {
                return res.status(404).json({ error: 'Bot not found' });
            }
            
            if (expiryDate) devData.premiumBots[botIndex].expiryDate = expiryDate;
            if (status) devData.premiumBots[botIndex].status = status;
            if (serverId) devData.premiumBots[botIndex].serverId = serverId;
            if (userId) devData.premiumBots[botIndex].userId = userId;
            
            fs.writeFileSync('./developers.json', JSON.stringify(devData, null, 2));
            res.json({ success: true, bot: devData.premiumBots[botIndex] });
        } catch (error) {
            console.error('Error updating bot:', error);
            res.status(500).json({ error: 'Failed to update bot' });
        }
    });
    
    // Get premium statistics (developer only)
    app.get('/api/developer/premium-stats', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const fs = require('fs');
            const devData = JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
            const bots = devData.premiumBots || [];
            
            const now = new Date();
            const stats = {
                totalBots: bots.length,
                activeBots: bots.filter(b => b.status === 'active' && new Date(b.expiryDate) > now).length,
                expiredBots: bots.filter(b => new Date(b.expiryDate) <= now).length,
                monthlyBots: bots.filter(b => b.subscriptionType === 'monthly').length,
                lifetimeBots: bots.filter(b => b.subscriptionType === 'lifetime').length,
                runningBots: premiumManager.getAllRunningBots().length,
                totalRevenue: bots.reduce((sum, b) => sum + (b.price || 0), 0),
                blacklistedUsers: (devData.blacklist || []).length
            };
            
            res.json(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    });
    
    // Add premium bot manually (developer only)
    app.post('/api/developer/premium-bots', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        try {
            const { userId, subscriptionType, serverId, token } = req.body;
            const fs = require('fs');
            const devData = JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
            
            const invoiceCode = subscriptionType === 'monthly' ? `M-${Date.now()}` : `L-${Date.now()}`;
            const expiryDate = subscriptionType === 'lifetime' 
                ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) // 100 years
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            
            const newBot = {
                invoiceCode,
                userId,
                subscriptionType,
                serverId: serverId || null,
                token: token ? premiumManager.encryptToken(token) : null,
                purchaseDate: new Date().toISOString(),
                expiryDate: expiryDate.toISOString(),
                status: 'active',
                price: subscriptionType === 'monthly' ? 600000 : 1200000
            };
            
            devData.premiumBots = devData.premiumBots || [];
            devData.premiumBots.push(newBot);
            fs.writeFileSync('./developers.json', JSON.stringify(devData, null, 2));
            
            res.json({ success: true, bot: { ...newBot, token: undefined } });
        } catch (error) {
            console.error('Error adding bot:', error);
            res.status(500).json({ error: 'Failed to add bot' });
        }
    });
    
    // ========================
    // User Premium Bots API (for users to see their own bots)
    // ========================
    app.get('/api/user/premium-bots', requireAuth, async (req, res) => {
        try {
            const fs = require('fs');
            const devData = JSON.parse(fs.readFileSync('./developers.json', 'utf8'));
            const userBots = (devData.premiumBots || [])
                .filter(b => b.userId === req.user.id)
                .map(b => ({
                    invoiceCode: b.invoiceCode,
                    subscriptionType: b.subscriptionType,
                    purchaseDate: b.purchaseDate,
                    expiryDate: b.expiryDate,
                    status: b.status,
                    isRunning: premiumManager.isBotRunning(b.invoiceCode),
                    hasToken: !!b.token
                }));
            
            res.json(userBots);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch your bots' });
        }
    });

    // ============ Premium Embeds API ============
    app.get("/api/premium/embed-settings", requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        try {
            const fs = require('fs');
            const makerData = JSON.parse(fs.readFileSync('./makerdb.json', 'utf8'));
            res.json(makerData.embedSettings || {
                title: '🤖 متجر البوتات البريميوم',
                description: 'يمكنك شراء نسختك الخاصة من البوت بتوكن خاص لمدة سنة كاملة!',
                color: '#FFD700',
                features: ['بوت خاص بك 100%', 'توكن مخصص', 'دعم فني مستمر', 'تحديثات مجانية', 'إعدادات مستقلة']
            });
        } catch {
            res.json({
                title: '🤖 متجر البوتات البريميوم',
                description: 'يمكنك شراء نسختك الخاصة من البوت بتوكن خاص لمدة سنة كاملة!',
                color: '#FFD700',
                features: ['بوت خاص بك 100%', 'توكن مخصص', 'دعم فني مستمر', 'تحديثات مجانية', 'إعدادات مستقلة']
            });
        }
    });

    app.post('/api/premium/embed-settings', requireAuth, (req, res) => {
        if (!isDeveloperUser(req.user.id)) return res.status(403).json({ error: 'Access denied' });
        try {
            const fs = require('fs');
            const makerData = JSON.parse(fs.readFileSync('./makerdb.json', 'utf8'));
            const { title, description, color, features } = req.body;
            makerData.embedSettings = {
                title: title || makerData.embedSettings?.title,
                description: description || makerData.embedSettings?.description,
                color: color || makerData.embedSettings?.color,
                features: features || makerData.embedSettings?.features
            };
            fs.writeFileSync('./makerdb.json', JSON.stringify(makerData, null, 2));
            res.json({ success: true, settings: makerData.embedSettings });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update embed settings' });
        }
    });

    return app;
}

module.exports = { createDashboardRoutes };
