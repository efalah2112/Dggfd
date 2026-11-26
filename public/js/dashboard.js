let currentGuildId = null;
let guildChannels = { textChannels: [], categories: [] };
let guildRoles = [];
let guildConfig = {};
let shopTypes = [];
let customRoles = [];

document.addEventListener('DOMContentLoaded', async function() {
    await loadUser();
    await loadGuilds();
    setupNavigation();
    setupImagePreviews();
    setupForms();
});

async function loadUser() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        
        const user = await response.json();
        document.getElementById('userDisplayName').textContent = user.username;
        document.getElementById('userAvatar').src = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
    } catch (error) {
        console.error('Error fetching user:', error);
        window.location.href = '/login.html';
    }
}

async function loadGuilds() {
    try {
        const response = await fetch('/api/guilds');
        if (!response.ok) return;
        
        const guilds = await response.json();
        const select = document.getElementById('guildSelect');
        
        guilds.forEach(guild => {
            const option = document.createElement('option');
            option.value = guild.id;
            option.textContent = guild.name;
            select.appendChild(option);
        });
        
        select.addEventListener('change', async function() {
            if (this.value) {
                currentGuildId = this.value;
                document.getElementById('no-guild-message').style.display = 'none';
                document.getElementById('page-content').style.display = 'block';
                document.getElementById('serverIcon').textContent = this.options[this.selectedIndex].text.charAt(0);
                await loadGuildData();
            } else {
                currentGuildId = null;
                document.getElementById('no-guild-message').style.display = 'block';
                document.getElementById('page-content').style.display = 'none';
            }
        });
        
        if (guilds.length === 1) {
            select.value = guilds[0].id;
            select.dispatchEvent(new Event('change'));
        }
    } catch (error) {
        console.error('Error loading guilds:', error);
    }
}

async function loadGuildData() {
    if (!currentGuildId) return;
    
    try {
        const [configRes, channelsRes, rolesRes, statsRes] = await Promise.all([
            fetch(`/api/guild/${currentGuildId}/config`),
            fetch(`/api/guild/${currentGuildId}/channels`),
            fetch(`/api/guild/${currentGuildId}/roles`),
            fetch(`/api/guild/${currentGuildId}/stats`)
        ]);
        
        if (configRes.ok) {
            const data = await configRes.json();
            guildConfig = data.config || {};
            populateForm(guildConfig);
        }
        
        if (channelsRes.ok) {
            guildChannels = await channelsRes.json();
            populateChannelSelects();
            populateCategorySelects();
        }
        
        if (rolesRes.ok) {
            guildRoles = await rolesRes.json();
            populateRoleSelects();
        }
        
        if (statsRes.ok) {
            const stats = await statsRes.json();
            document.getElementById('shopsCount').textContent = stats.shops || 0;
            document.getElementById('shopTypesCount').textContent = stats.shopTypes || 0;
            document.getElementById('rolesCount').textContent = stats.customRoles || 0;
            document.getElementById('membersCount').textContent = stats.members || 0;
        }
        
        await loadShopTypes();
        await loadCustomRoles();
    } catch (error) {
        console.error('Error loading guild data:', error);
    }
}

async function loadShopTypes() {
    if (!currentGuildId) return;
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/shop-types`);
        if (response.ok) {
            shopTypes = await response.json();
            renderShopTypes();
        }
    } catch (error) {
        console.error('Error loading shop types:', error);
    }
}

async function loadCustomRoles() {
    if (!currentGuildId) return;
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/custom-roles`);
        if (response.ok) {
            customRoles = await response.json();
            renderCustomRoles();
        }
    } catch (error) {
        console.error('Error loading custom roles:', error);
    }
}

function renderShopTypes() {
    const container = document.getElementById('shopTypesList');
    
    if (shopTypes.length === 0) {
        container.innerHTML = '<p class="no-items">لا توجد أنواع متاجر. اضغط على الزر أدناه لإضافة نوع جديد.</p>';
        return;
    }
    
    container.innerHTML = shopTypes.map(type => `
        <div class="shop-type-item">
            <div class="item-info">
                <div class="item-name">${escapeHtml(type.name)} (${escapeHtml(type.id)})</div>
                <div class="item-details">
                    E: ${type.every}% | H: ${type.here}% | S: ${type.shop}% | ضريبة: ${type.tax} | سعر: ${type.price}
                </div>
            </div>
            <div class="item-actions">
                <button class="edit-btn" onclick="editShopType('${type.id}')">تعديل</button>
                <button class="delete-btn" onclick="deleteShopType('${type.id}')">حذف</button>
            </div>
        </div>
    `).join('');
}

function renderCustomRoles() {
    const container = document.getElementById('customRolesList');
    
    if (customRoles.length === 0) {
        container.innerHTML = '<p class="no-items">لا توجد رتب مخصصة. اضغط على الزر أدناه لإضافة رتبة جديدة.</p>';
        return;
    }
    
    container.innerHTML = customRoles.map(role => `
        <div class="role-item">
            <div class="item-info">
                <div class="item-name">${escapeHtml(role.name)} (${escapeHtml(role.id)})</div>
                <div class="item-details">
                    السعر: ${role.price} | المميزات: ${escapeHtml(role.benefits || 'لا يوجد')}
                </div>
            </div>
            <div class="item-actions">
                <button class="edit-btn" onclick="editCustomRole('${role.id}')">تعديل</button>
                <button class="delete-btn" onclick="deleteCustomRole('${role.id}')">حذف</button>
            </div>
        </div>
    `).join('');
}

function populateChannelSelects() {
    const selects = document.querySelectorAll('.channel-select');
    selects.forEach(select => {
        const currentValue = guildConfig[select.id] || '';
        select.innerHTML = '<option value="">اختر روم...</option>';
        guildChannels.textChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `# ${channel.name}`;
            if (channel.id === currentValue) option.selected = true;
            select.appendChild(option);
        });
    });
}

function populateCategorySelects() {
    const selects = document.querySelectorAll('.category-select');
    selects.forEach(select => {
        const currentValue = guildConfig[select.id] || '';
        select.innerHTML = '<option value="">اختر كاتيجوري...</option>';
        guildChannels.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            if (cat.id === currentValue) option.selected = true;
            select.appendChild(option);
        });
    });
}

function populateRoleSelects() {
    const selects = document.querySelectorAll('.role-select');
    selects.forEach(select => {
        const currentValue = guildConfig[select.id] || '';
        select.innerHTML = '<option value="">اختر رتبة...</option>';
        guildRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.name;
            option.style.color = role.color;
            if (role.id === currentValue) option.selected = true;
            select.appendChild(option);
        });
    });
}

function populateForm(config) {
    const fields = [
        'mtagrcat', 'admins', 'logs', 'logsbuy', 'shoprole', 'transferBank',
        'Auctioncat', 'Actionadmins', 'auctionroom1', 'auctionroom2', 'mzad_auction',
        'no_tax_everyone_auction', 'tax_everyone_auction', 'no_tax_here_auction', 'tax_here_auction',
        'no_tax_mzad_auction', 'tax_mzad_auction', 'auctionRules',
        'ordercat', 'Ourderadmins', 'orderroom', 'role_nomen',
        'no_tax_everyone_price', 'tax_everyone_price', 'no_tax_here_price', 'tax_here_price',
        'no_tax_nomen_price', 'tax_nomen_price', 'orderRules',
        'Supportcat', 'Spportadmins', 'ticketsChannel', 'ticketWelcomeMessage',
        'role_ticket_category', 'help', 'adminRoles',
        'scamcat', 'scamadmins', 'logChannel', 'consoleRoom',
        'Adscat', 'Adsadmins',
        'color', 'Line', 'line', 'line3',
        'bunner', 'Supportimage', 'Auctionimage', 'orderimage', 'scamimage', 'Adsimage',
        'pricesDescription', 'pricesWelcomeMessage', 'rulesDescription'
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element && config[field] !== undefined) {
            element.value = config[field];
            
            if (element.type === 'url' || field.includes('image') || field === 'bunner') {
                const preview = document.getElementById(field + '_preview');
                if (preview && config[field]) {
                    preview.src = config[field];
                    preview.style.display = 'block';
                }
            }
        }
    });
}

function setupNavigation() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const pageSections = document.querySelectorAll('.page-section');

    sidebarItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            sidebarItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            const pageId = this.getAttribute('data-page');
            
            pageSections.forEach(section => {
                section.classList.remove('active');
            });
            
            const targetPage = document.getElementById(pageId + '-page');
            if (targetPage) {
                targetPage.classList.add('active');
            }
        });
    });
}

function setupImagePreviews() {
    const imageInputs = ['bunner', 'Supportimage', 'Auctionimage', 'orderimage', 'scamimage', 'Adsimage'];
    
    imageInputs.forEach(id => {
        const input = document.getElementById(id);
        const preview = document.getElementById(id + '_preview');
        
        if (input && preview) {
            input.addEventListener('input', function() {
                if (this.value) {
                    preview.src = this.value;
                    preview.style.display = 'block';
                    preview.onerror = () => { preview.style.display = 'none'; };
                } else {
                    preview.style.display = 'none';
                }
            });
        }
    });
}

function setupForms() {
    document.getElementById('shopTypeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveShopType();
    });
    
    document.getElementById('roleForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveCustomRole();
    });
}

async function saveSettings(section) {
    if (!currentGuildId) {
        showNotification('يرجى اختيار سيرفر أولاً', true);
        return;
    }
    
    let settings = {};
    
    switch(section) {
        case 'shop':
            settings = {
                mtagrcat: document.getElementById('mtagrcat').value,
                admins: document.getElementById('admins').value,
                logs: document.getElementById('logs').value,
                logsbuy: document.getElementById('logsbuy').value,
                shoprole: document.getElementById('shoprole').value,
                transferBank: document.getElementById('transferBank').value
            };
            break;
        case 'auction':
            settings = {
                Auctioncat: document.getElementById('Auctioncat').value,
                Actionadmins: document.getElementById('Actionadmins').value,
                auctionroom1: document.getElementById('auctionroom1').value,
                auctionroom2: document.getElementById('auctionroom2').value,
                mzad_auction: document.getElementById('mzad_auction').value,
                no_tax_everyone_auction: document.getElementById('no_tax_everyone_auction').value,
                tax_everyone_auction: document.getElementById('tax_everyone_auction').value,
                no_tax_here_auction: document.getElementById('no_tax_here_auction').value,
                tax_here_auction: document.getElementById('tax_here_auction').value,
                no_tax_mzad_auction: document.getElementById('no_tax_mzad_auction').value,
                tax_mzad_auction: document.getElementById('tax_mzad_auction').value,
                auctionRules: document.getElementById('auctionRules').value
            };
            break;
        case 'order':
            settings = {
                ordercat: document.getElementById('ordercat').value,
                Ourderadmins: document.getElementById('Ourderadmins').value,
                orderroom: document.getElementById('orderroom').value,
                role_nomen: document.getElementById('role_nomen').value,
                no_tax_everyone_price: document.getElementById('no_tax_everyone_price').value,
                tax_everyone_price: document.getElementById('tax_everyone_price').value,
                no_tax_here_price: document.getElementById('no_tax_here_price').value,
                tax_here_price: document.getElementById('tax_here_price').value,
                no_tax_nomen_price: document.getElementById('no_tax_nomen_price').value,
                tax_nomen_price: document.getElementById('tax_nomen_price').value,
                orderRules: document.getElementById('orderRules').value
            };
            break;
        case 'ticket':
            settings = {
                Supportcat: document.getElementById('Supportcat').value,
                Spportadmins: document.getElementById('Spportadmins').value,
                ticketsChannel: document.getElementById('ticketsChannel').value,
                ticketWelcomeMessage: document.getElementById('ticketWelcomeMessage').value
            };
            break;
        case 'role':
            settings = {
                role_ticket_category: document.getElementById('role_ticket_category').value,
                help: document.getElementById('help').value,
                adminRoles: document.getElementById('adminRoles').value
            };
            break;
        case 'moderation':
            settings = {
                scamcat: document.getElementById('scamcat').value,
                scamadmins: document.getElementById('scamadmins').value,
                logChannel: document.getElementById('logChannel').value,
                consoleRoom: document.getElementById('consoleRoom').value
            };
            break;
        case 'ads':
            settings = {
                Adscat: document.getElementById('Adscat').value,
                Adsadmins: document.getElementById('Adsadmins').value
            };
            break;
        case 'general':
            settings = {
                color: document.getElementById('color').value,
                Line: document.getElementById('Line').value,
                line: document.getElementById('line').value,
                line3: document.getElementById('line3').value
            };
            break;
        case 'banners':
            settings = {
                bunner: document.getElementById('bunner').value,
                Supportimage: document.getElementById('Supportimage').value,
                Auctionimage: document.getElementById('Auctionimage').value,
                orderimage: document.getElementById('orderimage').value,
                scamimage: document.getElementById('scamimage').value,
                Adsimage: document.getElementById('Adsimage').value
            };
            break;
        case 'messages':
            settings = {
                pricesDescription: document.getElementById('pricesDescription').value,
                pricesWelcomeMessage: document.getElementById('pricesWelcomeMessage').value,
                rulesDescription: document.getElementById('rulesDescription').value
            };
            break;
    }
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showNotification('تم الحفظ بنجاح');
            Object.assign(guildConfig, settings);
        } else {
            showNotification('فشل في الحفظ', true);
        }
    } catch (error) {
        console.error('Error saving:', error);
        showNotification('حدث خطأ', true);
    }
}

function openAddShopTypeModal() {
    document.getElementById('shopTypeModalTitle').textContent = 'إضافة نوع متجر';
    document.getElementById('shopTypeForm').reset();
    document.getElementById('editShopTypeId').value = '';
    document.getElementById('shopTypeEvery').value = 20;
    document.getElementById('shopTypeHere').value = 15;
    document.getElementById('shopTypeShop').value = 10;
    document.getElementById('shopTypeTax').value = 25000;
    document.getElementById('shopTypePrice').value = 2;
    document.getElementById('shopTypeModal').classList.add('active');
}

function editShopType(typeId) {
    const type = shopTypes.find(t => t.id === typeId);
    if (!type) return;
    
    document.getElementById('shopTypeModalTitle').textContent = 'تعديل نوع متجر';
    document.getElementById('editShopTypeId').value = typeId;
    document.getElementById('shopTypeId').value = type.id;
    document.getElementById('shopTypeName').value = type.name;
    document.getElementById('shopTypePrefix').value = type.prefix || '';
    document.getElementById('shopTypeRole').value = type.role || '';
    document.getElementById('shopTypeEvery').value = type.every;
    document.getElementById('shopTypeHere').value = type.here;
    document.getElementById('shopTypeShop').value = type.shop;
    document.getElementById('shopTypeTax').value = type.tax;
    document.getElementById('shopTypePrice').value = type.price;
    document.getElementById('shopTypeModal').classList.add('active');
}

async function saveShopType() {
    if (!currentGuildId) return;
    
    const editId = document.getElementById('editShopTypeId').value;
    const shopType = {
        id: document.getElementById('shopTypeId').value,
        name: document.getElementById('shopTypeName').value,
        prefix: document.getElementById('shopTypePrefix').value,
        role: document.getElementById('shopTypeRole').value,
        every: parseInt(document.getElementById('shopTypeEvery').value) || 20,
        here: parseInt(document.getElementById('shopTypeHere').value) || 15,
        shop: parseInt(document.getElementById('shopTypeShop').value) || 10,
        tax: parseInt(document.getElementById('shopTypeTax').value) || 25000,
        price: parseInt(document.getElementById('shopTypePrice').value) || 2
    };
    
    try {
        const url = editId 
            ? `/api/guild/${currentGuildId}/shop-types/${editId}`
            : `/api/guild/${currentGuildId}/shop-types`;
        
        const response = await fetch(url, {
            method: editId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shopType)
        });
        
        if (response.ok) {
            showNotification(editId ? 'تم التعديل بنجاح' : 'تمت الإضافة بنجاح');
            closeModal('shopTypeModal');
            await loadShopTypes();
            await loadGuildData();
        } else {
            showNotification('فشل في الحفظ', true);
        }
    } catch (error) {
        console.error('Error saving shop type:', error);
        showNotification('حدث خطأ', true);
    }
}

async function deleteShopType(typeId) {
    if (!currentGuildId) return;
    if (!confirm('هل تريد حذف هذا النوع؟')) return;
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/shop-types/${typeId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('تم الحذف بنجاح');
            await loadShopTypes();
            await loadGuildData();
        } else {
            showNotification('فشل في الحذف', true);
        }
    } catch (error) {
        console.error('Error deleting shop type:', error);
        showNotification('حدث خطأ', true);
    }
}

function openAddRoleModal() {
    document.getElementById('roleModalTitle').textContent = 'إضافة رتبة مخصصة';
    document.getElementById('roleForm').reset();
    document.getElementById('editRoleId').value = '';
    document.getElementById('customRolePrice').value = 0;
    document.getElementById('roleModal').classList.add('active');
}

function editCustomRole(roleId) {
    const role = customRoles.find(r => r.id === roleId);
    if (!role) return;
    
    document.getElementById('roleModalTitle').textContent = 'تعديل رتبة مخصصة';
    document.getElementById('editRoleId').value = roleId;
    document.getElementById('customRoleId').value = role.id;
    document.getElementById('customRoleName').value = role.name;
    document.getElementById('customRoleDiscordId').value = role.roleId || '';
    document.getElementById('customRolePrice').value = role.price || 0;
    document.getElementById('customRoleBenefits').value = role.benefits || '';
    document.getElementById('roleModal').classList.add('active');
}

async function saveCustomRole() {
    if (!currentGuildId) return;
    
    const editId = document.getElementById('editRoleId').value;
    const customRole = {
        id: document.getElementById('customRoleId').value,
        name: document.getElementById('customRoleName').value,
        roleId: document.getElementById('customRoleDiscordId').value,
        price: parseInt(document.getElementById('customRolePrice').value) || 0,
        benefits: document.getElementById('customRoleBenefits').value
    };
    
    try {
        const url = editId 
            ? `/api/guild/${currentGuildId}/custom-roles/${editId}`
            : `/api/guild/${currentGuildId}/custom-roles`;
        
        const response = await fetch(url, {
            method: editId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customRole)
        });
        
        if (response.ok) {
            showNotification(editId ? 'تم التعديل بنجاح' : 'تمت الإضافة بنجاح');
            closeModal('roleModal');
            await loadCustomRoles();
            await loadGuildData();
        } else {
            showNotification('فشل في الحفظ', true);
        }
    } catch (error) {
        console.error('Error saving custom role:', error);
        showNotification('حدث خطأ', true);
    }
}

async function deleteCustomRole(roleId) {
    if (!currentGuildId) return;
    if (!confirm('هل تريد حذف هذه الرتبة؟')) return;
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/custom-roles/${roleId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('تم الحذف بنجاح');
            await loadCustomRoles();
            await loadGuildData();
        } else {
            showNotification('فشل في الحذف', true);
        }
    } catch (error) {
        console.error('Error deleting custom role:', error);
        showNotification('حدث خطأ', true);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showNotification(message, isError = false) {
    const notification = document.getElementById('save-notification');
    notification.textContent = message;
    notification.classList.toggle('error', isError);
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ==================== Premium System Functions ====================
let isDeveloper = false;

async function checkDeveloperStatus() {
    try {
        const response = await fetch('/api/premium/is-developer');
        if (response.ok) {
            const data = await response.json();
            isDeveloper = data.isDeveloper;
            if (isDeveloper) {
                document.getElementById('premium-section').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error checking developer status:', error);
    }
}

async function loadPremiumStats() {
    if (!isDeveloper) return;
    try {
        const response = await fetch('/api/premium/stats');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('premiumActiveBots').textContent = data.stats.activeBots || 0;
            document.getElementById('premiumTotalSold').textContent = data.stats.totalPremiumSold || 0;
            document.getElementById('premiumBlacklistCount').textContent = data.blacklistUsers + data.blacklistServers || 0;
            document.getElementById('premiumDevsCount').textContent = data.developersCount || 0;
        }
    } catch (error) {
        console.error('Error loading premium stats:', error);
    }
}

async function loadPremiumBots() {
    if (!isDeveloper) return;
    try {
        const response = await fetch('/api/premium/bots');
        if (response.ok) {
            const bots = await response.json();
            const tbody = document.getElementById('premiumBotsList');
            tbody.innerHTML = '';
            bots.forEach(bot => {
                const expiry = new Date(bot.expiryDate).toLocaleDateString('ar-EG');
                const statusClass = bot.status === 'active' ? 'status-active' : 'status-expired';
                const statusText = bot.status === 'active' ? 'نشط' : 'منتهي';
                tbody.innerHTML += `
                    <tr>
                        <td>${escapeHtml(bot.id)}</td>
                        <td>${escapeHtml(bot.userId)}</td>
                        <td>${escapeHtml(bot.serverId)}</td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td>${expiry}</td>
                        <td>${escapeHtml(bot.invoiceCode)}</td>
                    </tr>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading premium bots:', error);
    }
}

async function loadBlacklist() {
    if (!isDeveloper) return;
    try {
        const response = await fetch('/api/premium/blacklist');
        if (response.ok) {
            const blacklist = await response.json();
            const usersList = document.getElementById('blacklistUsersList');
            const serversList = document.getElementById('blacklistServersList');
            
            usersList.innerHTML = blacklist.users.map(u => 
                `<li class="item-row"><span>${escapeHtml(u)}</span><button class="delete-btn" onclick="removeFromBlacklist('user', '${u}')">حذف</button></li>`
            ).join('') || '<li>لا يوجد</li>';
            
            serversList.innerHTML = blacklist.servers.map(s => 
                `<li class="item-row"><span>${escapeHtml(s)}</span><button class="delete-btn" onclick="removeFromBlacklist('server', '${s}')">حذف</button></li>`
            ).join('') || '<li>لا يوجد</li>';
        }
    } catch (error) {
        console.error('Error loading blacklist:', error);
    }
}

async function addPremiumBot() {
    const userId = document.getElementById('premiumUserId').value.trim();
    const serverId = document.getElementById('premiumServerId').value.trim();
    
    if (!userId || !serverId) {
        showNotification('يرجى ملء جميع الحقول', true);
        return;
    }
    
    try {
        const response = await fetch('/api/premium/add-bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, serverId })
        });
        
        if (response.ok) {
            showNotification('تم إضافة البريميوم بنجاح');
            document.getElementById('premiumUserId').value = '';
            document.getElementById('premiumServerId').value = '';
            await loadPremiumStats();
            await loadPremiumBots();
        } else {
            const error = await response.json();
            showNotification(error.error || 'فشل في الإضافة', true);
        }
    } catch (error) {
        console.error('Error adding premium bot:', error);
        showNotification('حدث خطأ', true);
    }
}

async function addToBlacklist() {
    const type = document.getElementById('blacklistType').value;
    const id = document.getElementById('blacklistId').value.trim();
    
    if (!id) {
        showNotification('يرجى إدخال الآيدي', true);
        return;
    }
    
    try {
        const response = await fetch('/api/premium/blacklist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, id })
        });
        
        if (response.ok) {
            showNotification('تم الإضافة للحظر');
            document.getElementById('blacklistId').value = '';
            await loadBlacklist();
            await loadPremiumStats();
        } else {
            const error = await response.json();
            showNotification(error.error || 'فشل', true);
        }
    } catch (error) {
        console.error('Error adding to blacklist:', error);
        showNotification('حدث خطأ', true);
    }
}

async function removeFromBlacklist(type, id) {
    if (!confirm('هل تريد إزالة هذا من القائمة السوداء؟')) return;
    
    try {
        const response = await fetch(`/api/premium/blacklist/${type}/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('تم الإزالة');
            await loadBlacklist();
            await loadPremiumStats();
        } else {
            showNotification('فشل في الإزالة', true);
        }
    } catch (error) {
        console.error('Error removing from blacklist:', error);
        showNotification('حدث خطأ', true);
    }
}

// Load premium data when switching to premium pages
const originalSetupNavigation = setupNavigation;
setupNavigation = function() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', async function(e) {
            e.preventDefault();
            
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            const page = this.dataset.page;
            
            document.querySelectorAll('.page-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const pageElement = document.getElementById(`${page}-page`);
            if (pageElement) {
                pageElement.classList.add('active');
            }
            
            // Load premium data when switching to premium pages
            if (page === 'premium-dashboard') {
                await loadPremiumStats();
            } else if (page === 'premium-bots') {
                await loadPremiumBots();
            } else if (page === 'premium-blacklist') {
                await loadBlacklist();
            }
        });
    });
};

// Check developer status on page load
document.addEventListener('DOMContentLoaded', async function() {
    await checkDeveloperStatus();
});

// ============ Premium Settings Functions ============
async function loadPremiumSettings() {
    if (!isDeveloper) return;
    try {
        const response = await fetch('/api/premium/settings');
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('premiumPrice').value = settings.premiumPrice || 5000;
            document.getElementById('premiumTransferBank').value = settings.transferBank || '';
        }
    } catch (error) {
        console.error('Error loading premium settings:', error);
    }
}

async function savePremiumSettings() {
    if (!isDeveloper) return showNotification('غير مصرح', true);
    
    const premiumPrice = document.getElementById('premiumPrice').value;
    const transferBank = document.getElementById('premiumTransferBank').value;
    
    try {
        const response = await fetch('/api/premium/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ premiumPrice, transferBank })
        });
        
        if (response.ok) {
            showNotification('تم حفظ الإعدادات بنجاح');
        } else {
            showNotification('فشل في الحفظ', true);
        }
    } catch (error) {
        console.error('Error saving premium settings:', error);
        showNotification('حدث خطأ', true);
    }
}

// Update loadPremiumStats to include settings
const originalLoadPremiumStats = loadPremiumStats;
loadPremiumStats = async function() {
    await originalLoadPremiumStats();
    await loadPremiumSettings();
};

// ============ Shops Management Functions ============
async function loadShops() {
    if (!currentGuildId) return;
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/shops`);
        if (response.ok) {
            const shops = await response.json();
            renderShopsList(shops);
        }
    } catch (error) {
        console.error('Error loading shops:', error);
    }
}

function renderShopsList(shops) {
    const tbody = document.getElementById('shopsList');
    if (!shops || shops.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد متاجر</td></tr>';
        return;
    }
    
    tbody.innerHTML = shops.map(shop => `
        <tr>
            <td>${escapeHtml(shop.name || 'بدون اسم')}</td>
            <td>${escapeHtml(shop.type || 'غير محدد')}</td>
            <td>${escapeHtml(shop.ownerName || shop.ownerId)}</td>
            <td>${shop.partners ? shop.partners.length : 0}</td>
            <td>${shop.taxPaid ? '<span class="status-badge status-active">مدفوع</span>' : '<span class="status-badge status-expired">غير مدفوع</span>'}</td>
            <td>
                <button class="action-btn view" onclick="viewShop('${shop.channelId}')">عرض</button>
                <button class="action-btn delete" onclick="deleteShop('${shop.channelId}')">حذف</button>
            </td>
        </tr>
    `).join('');
}

async function deleteShop(channelId) {
    if (!confirm('هل أنت متأكد من حذف هذا المتجر؟')) return;
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/shops/${channelId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            showNotification('تم حذف المتجر');
            await loadShops();
        } else {
            showNotification('فشل في الحذف', true);
        }
    } catch (error) {
        console.error('Error deleting shop:', error);
        showNotification('حدث خطأ', true);
    }
}

async function viewShop(channelId) {
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/shops/${channelId}`);
        if (response.ok) {
            const shop = await response.json();
            alert(`المتجر: ${shop.name}\nالنوع: ${shop.type}\nالمالك: ${shop.ownerName || shop.ownerId}\nالمساعدين: ${shop.partners ? shop.partners.length : 0}`);
        }
    } catch (error) {
        console.error('Error viewing shop:', error);
    }
}

// ============ Tax System Functions ============
async function loadTaxSettings() {
    if (!currentGuildId) return;
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/tax-settings`);
        if (response.ok) {
            const settings = await response.json();
            renderTaxPrices(settings.typeTaxes || {});
        }
    } catch (error) {
        console.error('Error loading tax settings:', error);
    }
}

function renderTaxPrices(typeTaxes) {
    const container = document.getElementById('taxPricesList');
    if (shopTypes.length === 0) {
        container.innerHTML = '<p class="no-items">لا توجد أنواع متاجر</p>';
        return;
    }
    
    container.innerHTML = shopTypes.map(type => `
        <div class="tax-price-item">
            <span class="type-name">${escapeHtml(type.name)}</span>
            <input type="number" id="tax_${type.id}" class="form-input" value="${typeTaxes[type.id] || type.tax || 0}" placeholder="سعر الضريبة">
        </div>
    `).join('');
}

async function saveTaxSettings() {
    if (!currentGuildId) return;
    
    const typeTaxes = {};
    shopTypes.forEach(type => {
        const input = document.getElementById(`tax_${type.id}`);
        if (input) {
            typeTaxes[type.id] = parseInt(input.value) || 0;
        }
    });
    
    const taxCategory = document.getElementById('taxCategory').value;
    const taxNotifyChannel = document.getElementById('taxNotifyChannel').value;
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/tax-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ typeTaxes, taxCategory, taxNotifyChannel })
        });
        
        if (response.ok) {
            showNotification('تم حفظ إعدادات الضرائب');
        } else {
            showNotification('فشل في الحفظ', true);
        }
    } catch (error) {
        console.error('Error saving tax settings:', error);
        showNotification('حدث خطأ', true);
    }
}

async function publishTaxes() {
    if (!currentGuildId) return;
    if (!confirm('هل تريد نشر الضرائب للمتاجر؟')) return;
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/publish-taxes`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('تم نشر الضرائب بنجاح');
        } else {
            showNotification('فشل في النشر', true);
        }
    } catch (error) {
        console.error('Error publishing taxes:', error);
        showNotification('حدث خطأ', true);
    }
}

// ============ Financial Stats Functions ============
let currentFinancialTab = 'paid';

async function loadFinancialStats() {
    if (!currentGuildId) return;
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/financial-stats`);
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('paidShopsCount').textContent = stats.paidCount || 0;
            document.getElementById('unpaidShopsCount').textContent = stats.unpaidCount || 0;
            document.getElementById('totalTaxRevenue').textContent = stats.totalRevenue || 0;
            renderFinancialList(stats);
        }
    } catch (error) {
        console.error('Error loading financial stats:', error);
    }
}

function showFinancialTab(tab) {
    currentFinancialTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadFinancialStats();
}

function renderFinancialList(stats) {
    const tbody = document.getElementById('financialList');
    const list = currentFinancialTab === 'paid' ? stats.paidShops : stats.unpaidShops;
    
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">لا توجد بيانات</td></tr>`;
        return;
    }
    
    tbody.innerHTML = list.map(shop => `
        <tr>
            <td>${escapeHtml(shop.name || 'بدون اسم')}</td>
            <td>${escapeHtml(shop.ownerName || shop.ownerId)}</td>
            <td>${shop.taxAmount || 0}</td>
            <td>${shop.lastPayDate || '-'}</td>
            <td>
                <button class="action-btn delete" onclick="deleteShop('${shop.channelId}')">حذف</button>
            </td>
        </tr>
    `).join('');
}

// ============ Mass Message Functions ============
function loadMassMessageTypes() {
    const container = document.getElementById('massMessageTypes');
    if (shopTypes.length === 0) {
        container.innerHTML = '<p class="no-items">لا توجد أنواع متاجر</p>';
        return;
    }
    
    container.innerHTML = shopTypes.map(type => `
        <label>
            <input type="checkbox" name="massMessageType" value="${type.id}">
            <span>${escapeHtml(type.name)}</span>
        </label>
    `).join('');
}

async function sendMassMessage() {
    if (!currentGuildId) return;
    
    const selectedTypes = Array.from(document.querySelectorAll('input[name="massMessageType"]:checked'))
        .map(cb => cb.value);
    
    if (selectedTypes.length === 0) {
        showNotification('اختر نوع متجر واحد على الأقل', true);
        return;
    }
    
    const title = document.getElementById('massMessageTitle').value;
    const content = document.getElementById('massMessageContent').value;
    const color = document.getElementById('massMessageColor').value;
    const category = document.getElementById('massMessageCategory').value;
    
    if (!title || !content) {
        showNotification('أدخل العنوان والمحتوى', true);
        return;
    }
    
    if (!confirm(`هل تريد إرسال الرسالة للمتاجر المحددة؟`)) return;
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/mass-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ types: selectedTypes, title, content, color, category })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`تم إرسال الرسالة لـ ${result.sentCount} متجر`);
        } else {
            showNotification('فشل في الإرسال', true);
        }
    } catch (error) {
        console.error('Error sending mass message:', error);
        showNotification('حدث خطأ', true);
    }
}

// ============ Embed Settings Functions ============
let savedEmbeds = [];

function previewEmbed() {
    const color = document.getElementById('embedColor').value;
    const title = document.getElementById('embedTitle').value || 'عنوان الإمبد';
    const description = document.getElementById('embedDescription').value || 'وصف الإمبد';
    const footer = document.getElementById('embedFooter').value || 'dev by : bh.x7 & _wx10';
    
    document.getElementById('embedColorBar').style.background = color;
    document.getElementById('embedTitlePreview').textContent = title;
    document.getElementById('embedDescPreview').textContent = description;
    document.getElementById('embedFooterPreview').textContent = footer;
}

async function saveEmbed() {
    if (!currentGuildId) return;
    
    const name = document.getElementById('embedName').value;
    if (!name) {
        showNotification('أدخل اسم للإمبد', true);
        return;
    }
    
    const embedData = {
        name,
        color: document.getElementById('embedColor').value,
        title: document.getElementById('embedTitle').value,
        description: document.getElementById('embedDescription').value,
        image: document.getElementById('embedImage').value,
        thumbnail: document.getElementById('embedThumbnail').value,
        footer: document.getElementById('embedFooter').value
    };
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/embeds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embedData)
        });
        
        if (response.ok) {
            showNotification('تم حفظ الإمبد');
            await loadSavedEmbeds();
            // Clear form
            document.getElementById('embedName').value = '';
            document.getElementById('embedTitle').value = '';
            document.getElementById('embedDescription').value = '';
            document.getElementById('embedImage').value = '';
            document.getElementById('embedThumbnail').value = '';
        } else {
            showNotification('فشل في الحفظ', true);
        }
    } catch (error) {
        console.error('Error saving embed:', error);
        showNotification('حدث خطأ', true);
    }
}

async function loadSavedEmbeds() {
    if (!currentGuildId) return;
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/embeds`);
        if (response.ok) {
            savedEmbeds = await response.json();
            renderSavedEmbeds();
        }
    } catch (error) {
        console.error('Error loading embeds:', error);
    }
}

function renderSavedEmbeds() {
    const container = document.getElementById('savedEmbedsList');
    if (savedEmbeds.length === 0) {
        container.innerHTML = '<p class="no-items">لا توجد إمبدات محفوظة</p>';
        return;
    }
    
    container.innerHTML = savedEmbeds.map(embed => `
        <li>
            <span>${escapeHtml(embed.name)}</span>
            <div>
                <button class="action-btn edit" onclick="loadEmbed('${embed.name}')">تحميل</button>
                <button class="action-btn delete" onclick="deleteEmbed('${embed.name}')">حذف</button>
            </div>
        </li>
    `).join('');
}

async function deleteEmbed(name) {
    if (!confirm('هل تريد حذف هذا الإمبد؟')) return;
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/embeds/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            showNotification('تم الحذف');
            await loadSavedEmbeds();
        }
    } catch (error) {
        console.error('Error deleting embed:', error);
    }
}

function loadEmbed(name) {
    const embed = savedEmbeds.find(e => e.name === name);
    if (!embed) return;
    
    document.getElementById('embedName').value = embed.name;
    document.getElementById('embedColor').value = embed.color || '#5865F2';
    document.getElementById('embedTitle').value = embed.title || '';
    document.getElementById('embedDescription').value = embed.description || '';
    document.getElementById('embedImage').value = embed.image || '';
    document.getElementById('embedThumbnail').value = embed.thumbnail || '';
    document.getElementById('embedFooter').value = embed.footer || '';
    previewEmbed();
}

// ============ Suggestions Settings Functions ============
async function loadSuggestionSettings() {
    if (!currentGuildId) return;
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/suggestion-settings`);
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('suggestionsChannel').value = settings.suggestionsChannel || '';
            document.getElementById('acceptedSuggestionsChannel').value = settings.acceptedChannel || '';
            document.getElementById('rejectedSuggestionsChannel').value = settings.rejectedChannel || '';
            document.getElementById('suggestionEmbedColor').value = settings.embedColor || '#5865F2';
            document.getElementById('suggestionAcceptMessage').value = settings.acceptMessage || '';
            document.getElementById('suggestionRejectMessage').value = settings.rejectMessage || '';
        }
    } catch (error) {
        console.error('Error loading suggestion settings:', error);
    }
}

async function saveSuggestionSettings() {
    if (!currentGuildId) return;
    
    const settings = {
        suggestionsChannel: document.getElementById('suggestionsChannel').value,
        acceptedChannel: document.getElementById('acceptedSuggestionsChannel').value,
        rejectedChannel: document.getElementById('rejectedSuggestionsChannel').value,
        embedColor: document.getElementById('suggestionEmbedColor').value,
        acceptMessage: document.getElementById('suggestionAcceptMessage').value,
        rejectMessage: document.getElementById('suggestionRejectMessage').value
    };
    
    try {
        const response = await fetch(`/api/guild/${currentGuildId}/suggestion-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showNotification('تم حفظ الإعدادات');
        } else {
            showNotification('فشل في الحفظ', true);
        }
    } catch (error) {
        console.error('Error saving suggestion settings:', error);
        showNotification('حدث خطأ', true);
    }
}

// ============ Website Tickets Functions ============
async function submitWebsiteTicket() {
    const subject = document.getElementById('ticketSubject').value;
    const description = document.getElementById('ticketDescription').value;
    
    if (!subject || !description) {
        showNotification('أدخل الموضوع والوصف', true);
        return;
    }
    
    try {
        const response = await fetch('/api/website-tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, description })
        });
        
        if (response.ok) {
            showNotification('تم إرسال التذكرة بنجاح');
            document.getElementById('ticketSubject').value = '';
            document.getElementById('ticketDescription').value = '';
            await loadMyTickets();
        } else {
            showNotification('فشل في الإرسال', true);
        }
    } catch (error) {
        console.error('Error submitting ticket:', error);
        showNotification('حدث خطأ', true);
    }
}

async function loadMyTickets() {
    try {
        const response = await fetch('/api/website-tickets/my');
        if (response.ok) {
            const tickets = await response.json();
            renderMyTickets(tickets);
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
}

function renderMyTickets(tickets) {
    const tbody = document.getElementById('myTicketsList');
    if (!tickets || tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد تذاكر</td></tr>';
        return;
    }
    
    tbody.innerHTML = tickets.map(ticket => `
        <tr>
            <td>#${ticket.id}</td>
            <td>${escapeHtml(ticket.subject)}</td>
            <td><span class="status-badge status-${ticket.status}">${getTicketStatusText(ticket.status)}</span></td>
            <td>${new Date(ticket.createdAt).toLocaleDateString('ar-EG')}</td>
            <td>
                <button class="action-btn view" onclick="viewTicket('${ticket.id}')">عرض</button>
            </td>
        </tr>
    `).join('');
}

function getTicketStatusText(status) {
    const statuses = {
        'open': 'مفتوحة',
        'pending': 'قيد المراجعة',
        'closed': 'مغلقة',
        'active': 'نشطة'
    };
    return statuses[status] || status;
}

async function viewTicket(ticketId) {
    try {
        const response = await fetch(`/api/website-tickets/${ticketId}`);
        if (response.ok) {
            const ticket = await response.json();
            alert(`التذكرة #${ticket.id}\n\nالموضوع: ${ticket.subject}\n\nالوصف: ${ticket.description}\n\nالحالة: ${getTicketStatusText(ticket.status)}\n\nالردود: ${ticket.replies ? ticket.replies.length : 0}`);
        }
    } catch (error) {
        console.error('Error viewing ticket:', error);
    }
}

// ============ Update Navigation for New Pages ============
const originalNavHandler = setupNavigation;
setupNavigation = function() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', async function(e) {
            e.preventDefault();
            
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            const page = this.dataset.page;
            
            document.querySelectorAll('.page-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const pageElement = document.getElementById(`${page}-page`);
            if (pageElement) {
                pageElement.classList.add('active');
            }
            
            // Load data based on page
            switch(page) {
                case 'premium-dashboard':
                    await loadPremiumStats();
                    break;
                case 'premium-bots':
                    await loadPremiumBots();
                    break;
                case 'premium-blacklist':
                    await loadBlacklist();
                    break;
                case 'shops-management':
                    await loadShops();
                    break;
                case 'tax-system':
                    await loadTaxSettings();
                    break;
                case 'financial-stats':
                    await loadFinancialStats();
                    break;
                case 'mass-message':
                    loadMassMessageTypes();
                    break;
                case 'embed-settings':
                    await loadSavedEmbeds();
                    previewEmbed();
                    break;
                case 'suggestions-settings':
                    await loadSuggestionSettings();
                    break;
                case 'website-tickets':
                    await loadMyTickets();
                    break;
            }
        });
    });
};

// Add event listeners for embed preview
document.addEventListener('DOMContentLoaded', function() {
    const embedInputs = ['embedColor', 'embedTitle', 'embedDescription', 'embedFooter'];
    embedInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', previewEmbed);
        }
    });
});

// ========================
// Embed Tabs Functions
// ========================
function showEmbedTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.embed-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Remove active from all buttons
    document.querySelectorAll('.embed-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    // Show selected tab
    const selectedTab = document.getElementById('embed-tab-' + tabName);
    if (selectedTab) selectedTab.classList.add('active');
    // Add active to clicked button
    event.target.classList.add('active');
}

function updateEmbedPreview() {
    const title = document.getElementById('embedTitle')?.value || 'تنظيم متاجر';
    const desc = document.getElementById('embedDescription')?.value || 'الرجاء اختيار الخدمه التي تريدها بالاسفل';
    const footer = document.getElementById('embedFooter')?.value || 'dev by : bh.x7 & _wx10';
    const color = document.getElementById('embedColor')?.value || '#5865F2';
    const image = document.getElementById('embedImage')?.value;
    
    document.getElementById('embedTitlePreview').textContent = title;
    document.getElementById('embedDescPreview').textContent = desc;
    document.getElementById('embedFooterPreview').textContent = footer;
    document.getElementById('embedColorBar').style.background = color;
    
    const imagePreview = document.getElementById('embedImagePreview');
    if (image && imagePreview) {
        imagePreview.innerHTML = `<img src="${image}" alt="Embed Image" onerror="this.style.display='none'">`;
    } else if (imagePreview) {
        imagePreview.innerHTML = '';
    }
}

async function saveEmbedSettings() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const data = {
        embedTitle: document.getElementById('embedTitle')?.value,
        embedDescription: document.getElementById('embedDescription')?.value,
        embedImage: document.getElementById('embedImage')?.value,
        embedFooter: document.getElementById('embedFooter')?.value,
        embedColor: document.getElementById('embedColor')?.value
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast('تم حفظ إعدادات الإمبد', 'success');
        } else {
            showToast('فشل في الحفظ', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

async function savePricesSettings() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const data = {
        pricesMessage: document.getElementById('pricesMessage')?.value,
        pricesTitle: document.getElementById('pricesTitle')?.value
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) showToast('تم حفظ إعدادات الأسعار', 'success');
        else showToast('فشل في الحفظ', 'error');
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

function addEmbedButton() {
    const list = document.getElementById('embedButtonsList');
    const count = list.children.length + 1;
    const item = document.createElement('div');
    item.className = 'button-item';
    item.innerHTML = `
        <input type="text" class="form-input dark-input" placeholder="نص الزر" id="button${count}Text">
        <select class="form-select dark-input" id="button${count}Style">
            <option value="primary">أزرق</option>
            <option value="secondary">رمادي</option>
            <option value="success">أخضر</option>
            <option value="danger">أحمر</option>
        </select>
        <input type="text" class="form-input dark-input" placeholder="الإيموجي" id="button${count}Emoji">
    `;
    list.appendChild(item);
}

async function saveButtonsSettings() {
    showToast('تم حفظ إعدادات الأزرار', 'success');
}

// ========================
// Tax Calculator Functions
// ========================
function showCalcTab(tabName) {
    document.querySelectorAll('.calc-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.calc-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const selectedTab = document.getElementById('calc-tab-' + tabName);
    if (selectedTab) selectedTab.classList.add('active');
    event.target.classList.add('active');
}

function calculateNormalTax() {
    const amount = parseFloat(document.getElementById('normalTaxAmount')?.value) || 0;
    if (amount <= 0) {
        showToast('أدخل مبلغ صحيح', 'error');
        return;
    }
    
    const tax = amount * 0.05; // 5% tax
    const brokerFee = amount * 0.0015; // 0.15% broker fee
    const total = amount + tax + brokerFee;
    
    document.getElementById('normalTaxResult').innerHTML = `
        <h3>💵 نتيجة الحساب</h3>
        <p><strong>المبلغ الأصلي:</strong> <span class="amount">${amount.toLocaleString()}</span></p>
        <p><strong>الضريبة (5%):</strong> ${tax.toLocaleString()}</p>
        <p><strong>رسوم الوسيط (0.15%):</strong> ${brokerFee.toLocaleString()}</p>
        <p><strong>الإجمالي مع الضريبة:</strong> <span class="amount">${total.toLocaleString()}</span></p>
    `;
}

function calculateRobloxTax() {
    const amount = parseFloat(document.getElementById('robloxTaxAmount')?.value) || 0;
    if (amount <= 0) {
        showToast('أدخل مبلغ صحيح', 'error');
        return;
    }
    
    const tax = amount * 0.30; // 30% Roblox tax
    const netAmount = amount - tax;
    
    document.getElementById('robloxTaxResult').innerHTML = `
        <h3>🎮 نتيجة ضريبة الروبوكس</h3>
        <p><strong>المبلغ الأصلي:</strong> <span class="amount">${amount.toLocaleString()} R$</span></p>
        <p><strong>الضريبة (30%):</strong> ${tax.toLocaleString()} R$</p>
        <p><strong>الصافي بعد الضريبة:</strong> <span class="amount">${netAmount.toLocaleString()} R$</span></p>
    `;
}

function calculateAllTaxes() {
    const amount = parseFloat(document.getElementById('allTaxAmount')?.value) || 0;
    if (amount <= 0) {
        showToast('أدخل مبلغ صحيح', 'error');
        return;
    }
    
    // Normal tax
    const normalTax = amount * 0.05;
    const brokerFee = amount * 0.0015;
    const normalTotal = amount + normalTax + brokerFee;
    
    // Roblox tax
    const robloxTax = amount * 0.30;
    const robloxNet = amount - robloxTax;
    
    document.getElementById('allTaxResults').innerHTML = `
        <div class="calc-result-card">
            <h3>💵 الضريبة العادية</h3>
            <p><strong>الضريبة:</strong> ${normalTax.toLocaleString()}</p>
            <p><strong>الوسيط:</strong> ${brokerFee.toLocaleString()}</p>
            <p><strong>الإجمالي:</strong> <span class="amount">${normalTotal.toLocaleString()}</span></p>
        </div>
        <div class="calc-result-card roblox">
            <h3>🎮 ضريبة الروبوكس</h3>
            <p><strong>الضريبة:</strong> ${robloxTax.toLocaleString()} R$</p>
            <p><strong>الصافي:</strong> <span class="amount">${robloxNet.toLocaleString()} R$</span></p>
            <p><strong>النسبة:</strong> 30%</p>
        </div>
    `;
}

// Auto-update preview on input change
document.addEventListener('DOMContentLoaded', function() {
    const embedInputs = ['embedTitle', 'embedDescription', 'embedFooter', 'embedColor', 'embedImage'];
    embedInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateEmbedPreview);
        }
    });
});

// ========================
// Rules Settings Functions
// ========================
async function saveRulesSettings() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const data = {
        shopRulesTitle: document.getElementById('shopRulesTitle')?.value,
        shopRulesDesc: document.getElementById('shopRulesDesc')?.value,
        shopRulesFooter: document.getElementById('shopRulesFooter')?.value,
        shopRulesImage: document.getElementById('shopRulesImage')?.value,
        postRulesTitle: document.getElementById('postRulesTitle')?.value,
        postRulesDesc: document.getElementById('postRulesDesc')?.value,
        postRulesFooter: document.getElementById('postRulesFooter')?.value,
        postRulesImage: document.getElementById('postRulesImage')?.value
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) showToast('تم حفظ إعدادات القوانين', 'success');
        else showToast('فشل في الحفظ', 'error');
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

// ========================
// Shop Organize Functions
// ========================
async function saveShopOrganizeSettings() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const data = {
        buyTicketRoom: document.getElementById('buyTicketRoom')?.value,
        auctionTicketRoom: document.getElementById('auctionTicketRoom')?.value,
        orderTicketRoom: document.getElementById('orderTicketRoom')?.value,
        auctionEmbedTitle: document.getElementById('auctionEmbedTitle')?.value,
        auctionEmbedDesc: document.getElementById('auctionEmbedDesc')?.value,
        auctionButtonText: document.getElementById('auctionButtonText')?.value,
        orderEmbedTitle: document.getElementById('orderEmbedTitle')?.value,
        orderEmbedDesc: document.getElementById('orderEmbedDesc')?.value,
        orderButtonText: document.getElementById('orderButtonText')?.value
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) showToast('تم حفظ إعدادات تنظيم المتاجر', 'success');
        else showToast('فشل في الحفظ', 'error');
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

async function sendBuyTicketEmbed() {
    const roomId = document.getElementById('buyTicketRoom')?.value;
    if (!roomId) return showToast('أدخل آيدي الروم', 'error');
    await sendTicketEmbed('buy', roomId);
}

async function sendAuctionTicketEmbed() {
    const roomId = document.getElementById('auctionTicketRoom')?.value;
    if (!roomId) return showToast('أدخل آيدي الروم', 'error');
    await sendTicketEmbed('auction', roomId);
}

async function sendOrderTicketEmbed() {
    const roomId = document.getElementById('orderTicketRoom')?.value;
    if (!roomId) return showToast('أدخل آيدي الروم', 'error');
    await sendTicketEmbed('order', roomId);
}

async function sendTicketEmbed(type, roomId) {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/send-ticket-embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, roomId })
        });
        if (res.ok) showToast('تم إرسال الإمبد بنجاح', 'success');
        else showToast('فشل في الإرسال', 'error');
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

// ========================
// System Logs Functions
// ========================
let currentLogsTab = 'all';

function showLogsTab(tabName) {
    currentLogsTab = tabName;
    document.querySelectorAll('.log-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    refreshLogs();
}

async function refreshLogs() {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/logs?type=${currentLogsTab}`);
        if (res.ok) {
            const data = await res.json();
            updateLogsStats(data.stats || {});
            renderLogs(data.logs || []);
        }
    } catch (e) {
        console.error('Error fetching logs:', e);
    }
}

function updateLogsStats(stats) {
    document.getElementById('totalLogsCount').textContent = stats.total || 0;
    document.getElementById('loginLogsCount').textContent = stats.login || 0;
    document.getElementById('failedLogsCount').textContent = stats.failed || 0;
    document.getElementById('settingsLogsCount').textContent = stats.settings || 0;
}

function renderLogs(logs) {
    const tbody = document.getElementById('logsList');
    if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">لا توجد سجلات</td></tr>';
        return;
    }
    
    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${new Date(log.timestamp).toLocaleString('ar')}</td>
            <td><span class="status-badge ${log.type}">${log.typeLabel}</span></td>
            <td>${log.user || '-'}</td>
            <td>${log.action}</td>
            <td>${log.details || '-'}</td>
        </tr>
    `).join('');
}

async function clearLogs() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    if (!confirm('هل تريد مسح جميع السجلات؟')) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/logs`, {
            method: 'DELETE'
        });
        if (res.ok) {
            showToast('تم مسح السجلات', 'success');
            refreshLogs();
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

// ========================
// Embed Messages Functions
// ========================
let currentEmbedId = null;
let embedFields = [];

function showCreateEmbedModal() {
    currentEmbedId = null;
    embedFields = [];
    document.getElementById('embedName').value = '';
    document.getElementById('embedMessageContent').value = '';
    document.getElementById('embedAuthorName').value = '';
    document.getElementById('embedAuthorUrl').value = '';
    document.getElementById('embedTitle').value = '';
    document.getElementById('embedDescription').value = '';
    document.getElementById('embedImage').value = '';
    document.getElementById('embedThumbnail').value = '';
    document.getElementById('embedFooter').value = '';
    document.getElementById('embedColorPicker').value = '#5865F2';
    document.getElementById('embedFieldsContainer').innerHTML = '';
    populateChannelSelect('embedSendChannel');
    document.getElementById('embedEditorModal').style.display = 'flex';
    switchEmbedTab('embed');
    updateEmbedPreview();
}

function closeEmbedModal() {
    document.getElementById('embedEditorModal').style.display = 'none';
}

function switchEmbedTab(tab) {
    document.querySelectorAll('.tabs-container .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    if (tab === 'message') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        document.getElementById('embed-message-tab').style.display = 'block';
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        document.getElementById('embed-embed-tab').style.display = 'block';
    }
}

function selectEmbedColor(color) {
    document.getElementById('embedColorPicker').value = color;
    updateEmbedPreview();
}

function addEmbedField() {
    const container = document.getElementById('embedFieldsContainer');
    const fieldId = Date.now();
    const fieldHtml = `
        <div class="embed-field" id="field-${fieldId}" style="background: #2a2d31; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
            <div class="form-group">
                <label>اسم الحقل</label>
                <input type="text" class="form-input field-name" placeholder="اسم الحقل">
            </div>
            <div class="form-group">
                <label>قيمة الحقل</label>
                <textarea class="form-textarea field-value" rows="2" placeholder="قيمة الحقل"></textarea>
            </div>
            <div class="form-group">
                <label><input type="checkbox" class="field-inline"> في سطر واحد (Inline)</label>
            </div>
            <button class="danger-btn" onclick="removeEmbedField('${fieldId}')">حذف الحقل</button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', fieldHtml);
}

function removeEmbedField(fieldId) {
    document.getElementById(`field-${fieldId}`)?.remove();
}

function updateEmbedPreview() {
    const color = document.getElementById('embedColorPicker')?.value || '#5865F2';
    const title = document.getElementById('embedTitle')?.value || '';
    const description = document.getElementById('embedDescription')?.value || '';
    const footer = document.getElementById('embedFooter')?.value || '';
    const image = document.getElementById('embedImage')?.value || '';
    
    const preview = document.getElementById('embedPreviewContent');
    if (!preview) return;
    
    preview.parentElement.style.borderLeftColor = color;
    preview.querySelector('.preview-title').textContent = title;
    preview.querySelector('.preview-description').textContent = description;
    preview.querySelector('.preview-footer').textContent = footer;
    
    const imgContainer = preview.querySelector('.preview-image');
    if (image) {
        imgContainer.innerHTML = `<img src="${image}" style="max-width: 100%; border-radius: 4px;">`;
    } else {
        imgContainer.innerHTML = '';
    }
}

async function saveEmbed() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const name = document.getElementById('embedName').value;
    if (!name) return showToast('أدخل اسم الإيمبد', 'error');
    
    const fields = [];
    document.querySelectorAll('.embed-field').forEach(field => {
        fields.push({
            name: field.querySelector('.field-name').value,
            value: field.querySelector('.field-value').value,
            inline: field.querySelector('.field-inline').checked
        });
    });
    
    const embedData = {
        id: currentEmbedId || Date.now().toString(),
        name,
        messageContent: document.getElementById('embedMessageContent').value,
        color: document.getElementById('embedColorPicker').value,
        authorName: document.getElementById('embedAuthorName').value,
        authorUrl: document.getElementById('embedAuthorUrl').value,
        title: document.getElementById('embedTitle').value,
        description: document.getElementById('embedDescription').value,
        image: document.getElementById('embedImage').value,
        thumbnail: document.getElementById('embedThumbnail').value,
        footer: document.getElementById('embedFooter').value,
        fields
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/embeds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embedData)
        });
        if (res.ok) {
            showToast('تم حفظ الإيمبد بنجاح', 'success');
            closeEmbedModal();
            loadEmbedMessages();
        } else {
            showToast('فشل في حفظ الإيمبد', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

async function sendEmbedToChannel() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const channelId = document.getElementById('embedSendChannel').value;
    if (!channelId) return showToast('اختر روم للإرسال', 'error');
    
    const fields = [];
    document.querySelectorAll('.embed-field').forEach(field => {
        fields.push({
            name: field.querySelector('.field-name').value,
            value: field.querySelector('.field-value').value,
            inline: field.querySelector('.field-inline').checked
        });
    });
    
    const embedData = {
        channelId,
        messageContent: document.getElementById('embedMessageContent').value,
        color: document.getElementById('embedColorPicker').value,
        authorName: document.getElementById('embedAuthorName').value,
        authorUrl: document.getElementById('embedAuthorUrl').value,
        title: document.getElementById('embedTitle').value,
        description: document.getElementById('embedDescription').value,
        image: document.getElementById('embedImage').value,
        thumbnail: document.getElementById('embedThumbnail').value,
        footer: document.getElementById('embedFooter').value,
        fields
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/send-embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embedData)
        });
        if (res.ok) {
            showToast('تم إرسال الإيمبد بنجاح', 'success');
        } else {
            showToast('فشل في إرسال الإيمبد', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

async function loadEmbedMessages() {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/embeds`);
        if (!res.ok) return;
        
        const embeds = await res.json();
        const container = document.getElementById('embedMessagesList');
        
        if (embeds.length === 0) {
            container.innerHTML = '<div class="no-data-message">لا توجد رسائل إيمبد. أنشئ واحدة جديدة!</div>';
            return;
        }
        
        container.innerHTML = embeds.map(embed => `
            <div class="embed-card" style="background: #2a2d31; padding: 15px; border-radius: 8px; border-left: 4px solid ${embed.color || '#5865F2'}; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4>${embed.name}</h4>
                    <div>
                        <button class="secondary-btn" onclick="editEmbed('${embed.id}')">تعديل</button>
                        <button class="danger-btn" onclick="deleteEmbed('${embed.id}')">حذف</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error loading embeds:', e);
    }
}

async function editEmbed(embedId) {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/embeds/${embedId}`);
        if (!res.ok) return;
        
        const embed = await res.json();
        currentEmbedId = embedId;
        
        document.getElementById('embedName').value = embed.name || '';
        document.getElementById('embedMessageContent').value = embed.messageContent || '';
        document.getElementById('embedColorPicker').value = embed.color || '#5865F2';
        document.getElementById('embedAuthorName').value = embed.authorName || '';
        document.getElementById('embedAuthorUrl').value = embed.authorUrl || '';
        document.getElementById('embedTitle').value = embed.title || '';
        document.getElementById('embedDescription').value = embed.description || '';
        document.getElementById('embedImage').value = embed.image || '';
        document.getElementById('embedThumbnail').value = embed.thumbnail || '';
        document.getElementById('embedFooter').value = embed.footer || '';
        
        document.getElementById('embedFieldsContainer').innerHTML = '';
        if (embed.fields) {
            embed.fields.forEach(field => {
                addEmbedField();
                const lastField = document.querySelector('.embed-field:last-child');
                lastField.querySelector('.field-name').value = field.name || '';
                lastField.querySelector('.field-value').value = field.value || '';
                lastField.querySelector('.field-inline').checked = field.inline || false;
            });
        }
        
        populateChannelSelect('embedSendChannel');
        document.getElementById('embedEditorModal').style.display = 'flex';
        updateEmbedPreview();
    } catch (e) {
        showToast('فشل في تحميل الإيمبد', 'error');
    }
}

async function deleteEmbed(embedId) {
    if (!confirm('هل تريد حذف هذا الإيمبد؟')) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/embeds/${embedId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('تم حذف الإيمبد', 'success');
            loadEmbedMessages();
        } else {
            showToast('فشل في الحذف', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

// ========================
// Auto Reply Functions
// ========================
let currentAutoReplyId = null;

function showAddAutoReplyModal() {
    currentAutoReplyId = null;
    document.getElementById('autoReplyTrigger').value = '';
    document.getElementById('autoReplyResponse').value = '';
    document.getElementById('autoReplyExactMatch').checked = false;
    document.getElementById('autoReplyAsReply').checked = false;
    document.getElementById('randomRepliesContainer').innerHTML = '';
    populateRoleSelect('autoReplyEnabledRoles');
    populateRoleSelect('autoReplyDisabledRoles');
    populateChannelSelect('autoReplyEnabledChannels');
    populateChannelSelect('autoReplyDisabledChannels');
    document.getElementById('autoReplyModal').style.display = 'flex';
}

function closeAutoReplyModal() {
    document.getElementById('autoReplyModal').style.display = 'none';
}

function addRandomReply() {
    const container = document.getElementById('randomRepliesContainer');
    const replyId = Date.now();
    const html = `
        <div class="random-reply" id="random-${replyId}" style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" class="form-input random-reply-text" placeholder="رد عشوائي إضافي" style="flex: 1;">
            <button class="danger-btn" onclick="document.getElementById('random-${replyId}').remove()">حذف</button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

async function saveAutoReply() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const trigger = document.getElementById('autoReplyTrigger').value;
    if (!trigger) return showToast('أدخل الكلمة المفتاحية', 'error');
    
    const randomReplies = [];
    document.querySelectorAll('.random-reply-text').forEach(input => {
        if (input.value) randomReplies.push(input.value);
    });
    
    const replyData = {
        id: currentAutoReplyId || Date.now().toString(),
        trigger,
        response: document.getElementById('autoReplyResponse').value,
        exactMatch: document.getElementById('autoReplyExactMatch').checked,
        asReply: document.getElementById('autoReplyAsReply').checked,
        randomReplies,
        enabledRoles: Array.from(document.getElementById('autoReplyEnabledRoles').selectedOptions).map(o => o.value),
        disabledRoles: Array.from(document.getElementById('autoReplyDisabledRoles').selectedOptions).map(o => o.value),
        enabledChannels: Array.from(document.getElementById('autoReplyEnabledChannels').selectedOptions).map(o => o.value),
        disabledChannels: Array.from(document.getElementById('autoReplyDisabledChannels').selectedOptions).map(o => o.value)
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/auto-replies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(replyData)
        });
        if (res.ok) {
            showToast('تم حفظ الرد التلقائي', 'success');
            closeAutoReplyModal();
            loadAutoReplies();
        } else {
            showToast('فشل في الحفظ', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

async function loadAutoReplies() {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/auto-replies`);
        if (!res.ok) return;
        
        const replies = await res.json();
        const container = document.getElementById('autoReplyList');
        
        if (replies.length === 0) {
            container.innerHTML = `
                <div class="no-data-center">
                    <div class="no-data-icon">💬</div>
                    <p>!No responses. create the first response</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = replies.map((reply, index) => `
            <div class="auto-reply-card" style="background: #2a2d31; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span class="badge" style="background: #5865F2; padding: 5px 10px; border-radius: 4px;">${index + 1}</span>
                    <strong style="margin-right: 10px;">${reply.trigger}</strong>
                </div>
                <div>
                    <button class="secondary-btn" onclick="editAutoReply('${reply.id}')">تعديل</button>
                    <button class="danger-btn" onclick="deleteAutoReply('${reply.id}')">حذف</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error loading auto replies:', e);
    }
}

async function editAutoReply(replyId) {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/auto-replies/${replyId}`);
        if (!res.ok) return;
        
        const reply = await res.json();
        currentAutoReplyId = replyId;
        
        document.getElementById('autoReplyTrigger').value = reply.trigger || '';
        document.getElementById('autoReplyResponse').value = reply.response || '';
        document.getElementById('autoReplyExactMatch').checked = reply.exactMatch || false;
        document.getElementById('autoReplyAsReply').checked = reply.asReply || false;
        
        document.getElementById('randomRepliesContainer').innerHTML = '';
        if (reply.randomReplies) {
            reply.randomReplies.forEach(text => {
                addRandomReply();
                document.querySelector('.random-reply:last-child .random-reply-text').value = text;
            });
        }
        
        populateRoleSelect('autoReplyEnabledRoles');
        populateRoleSelect('autoReplyDisabledRoles');
        populateChannelSelect('autoReplyEnabledChannels');
        populateChannelSelect('autoReplyDisabledChannels');
        
        document.getElementById('autoReplyModal').style.display = 'flex';
    } catch (e) {
        showToast('فشل في تحميل الرد', 'error');
    }
}

async function deleteAutoReply(replyId) {
    if (!confirm('هل تريد حذف هذا الرد التلقائي؟')) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/auto-replies/${replyId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('تم حذف الرد التلقائي', 'success');
            loadAutoReplies();
        } else {
            showToast('فشل في الحذف', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

// ========================
// Auto Line Functions
// ========================
async function loadAutoLineSettings() {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/auto-line`);
        if (!res.ok) return;
        
        const settings = await res.json();
        document.getElementById('autoLineEnabled').checked = settings.enabled || false;
        document.getElementById('autoLineImage').value = settings.image || '';
        document.getElementById('autoLineText').value = settings.text || '';
        document.getElementById('autoLineDelay').value = settings.delay || 2;
        
        populateChannelSelect('autoLineChannels');
        if (settings.channels) {
            const select = document.getElementById('autoLineChannels');
            settings.channels.forEach(channelId => {
                const option = select.querySelector(`option[value="${channelId}"]`);
                if (option) option.selected = true;
            });
        }
    } catch (e) {
        console.error('Error loading auto line settings:', e);
    }
}

async function saveAutoLineSettings() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const settings = {
        enabled: document.getElementById('autoLineEnabled').checked,
        image: document.getElementById('autoLineImage').value,
        text: document.getElementById('autoLineText').value,
        delay: parseInt(document.getElementById('autoLineDelay').value) || 2,
        channels: Array.from(document.getElementById('autoLineChannels').selectedOptions).map(o => o.value)
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/auto-line`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (res.ok) {
            showToast('تم حفظ إعدادات الخط التلقائي', 'success');
        } else {
            showToast('فشل في الحفظ', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

// ========================
// Tax Room Functions
// ========================
async function loadTaxRoomSettings() {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/tax-room`);
        if (!res.ok) return;
        
        const settings = await res.json();
        populateChannelSelect('taxRoomChannel');
        document.getElementById('taxRoomChannel').value = settings.channel || '';
        document.getElementById('taxNotificationsEnabled').checked = settings.notificationsEnabled || false;
        document.getElementById('taxEmbedTitle').value = settings.embedTitle || '📊 إشعار ضريبة';
        document.getElementById('taxEmbedDescription').value = settings.embedDescription || '';
        document.getElementById('taxEmbedColor').value = settings.embedColor || '#5865F2';
        document.getElementById('taxEmbedImage').value = settings.embedImage || '';
        document.getElementById('taxEmbedFooter').value = settings.embedFooter || '';
    } catch (e) {
        console.error('Error loading tax room settings:', e);
    }
}

async function saveTaxRoomSettings() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const settings = {
        channel: document.getElementById('taxRoomChannel').value,
        notificationsEnabled: document.getElementById('taxNotificationsEnabled').checked,
        embedTitle: document.getElementById('taxEmbedTitle').value,
        embedDescription: document.getElementById('taxEmbedDescription').value,
        embedColor: document.getElementById('taxEmbedColor').value,
        embedImage: document.getElementById('taxEmbedImage').value,
        embedFooter: document.getElementById('taxEmbedFooter').value
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/tax-room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (res.ok) {
            showToast('تم حفظ إعدادات روم الضرائب', 'success');
        } else {
            showToast('فشل في الحفظ', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

// Helper function to populate channel selects
function populateChannelSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">اختر روم</option>';
    if (guildChannels && guildChannels.textChannels) {
        guildChannels.textChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = '#' + channel.name;
            select.appendChild(option);
        });
    }
}

// Helper function to populate role selects
function populateRoleSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '';
    if (guildRoles) {
        guildRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.name;
            select.appendChild(option);
        });
    }
}

// Add listeners for embed preview updates
document.addEventListener('DOMContentLoaded', function() {
    ['embedTitle', 'embedDescription', 'embedFooter', 'embedImage', 'embedColorPicker'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateEmbedPreview);
        }
    });
});

// ========================
// Ticket Embed Functions
// ========================
let currentTicketEmbeds = {};

function showTicketEmbedTab(type) {
    document.querySelectorAll('.ticket-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('currentTicketType').value = type;
    loadTicketEmbed(type);
}

async function loadTicketEmbed(type) {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/ticket-embeds/${type}`);
        if (!res.ok) return;
        
        const embed = await res.json();
        currentTicketEmbeds[type] = embed;
        
        document.getElementById('ticketEmbedTitle').value = embed.title || '';
        document.getElementById('ticketEmbedDescription').value = embed.description || '';
        document.getElementById('ticketEmbedColor').value = embed.color || '#5865F2';
        document.getElementById('ticketEmbedImage').value = embed.image || '';
        document.getElementById('ticketEmbedThumbnail').value = embed.thumbnail || '';
        document.getElementById('ticketButtonText').value = embed.buttonText || '';
        document.getElementById('ticketButtonEmoji').value = embed.buttonEmoji || '';
        document.getElementById('ticketWelcomeTitle').value = embed.welcomeTitle || '';
        document.getElementById('ticketWelcomeDesc').value = embed.welcomeDesc || '';
        document.getElementById('ticketWelcomeImage').value = embed.welcomeImage || '';
        document.getElementById('ticketRulesText').value = embed.rulesText || '';
        document.getElementById('ticketPricesText').value = embed.pricesText || '';
    } catch (e) {
        console.error('Error loading ticket embed:', e);
    }
}

async function saveTicketEmbed() {
    if (!selectedGuild) return showToast('اختر سيرفر أولاً', 'error');
    
    const type = document.getElementById('currentTicketType').value;
    const embed = {
        title: document.getElementById('ticketEmbedTitle').value,
        description: document.getElementById('ticketEmbedDescription').value,
        color: document.getElementById('ticketEmbedColor').value,
        image: document.getElementById('ticketEmbedImage').value,
        thumbnail: document.getElementById('ticketEmbedThumbnail').value,
        buttonText: document.getElementById('ticketButtonText').value,
        buttonEmoji: document.getElementById('ticketButtonEmoji').value,
        welcomeTitle: document.getElementById('ticketWelcomeTitle').value,
        welcomeDesc: document.getElementById('ticketWelcomeDesc').value,
        welcomeImage: document.getElementById('ticketWelcomeImage').value,
        rulesText: document.getElementById('ticketRulesText').value,
        pricesText: document.getElementById('ticketPricesText').value
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/ticket-embeds/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed)
        });
        if (res.ok) {
            showToast('تم حفظ إعدادات الإيمبد بنجاح', 'success');
            currentTicketEmbeds[type] = embed;
        } else {
            showToast('فشل في الحفظ', 'error');
        }
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

async function loadAllTicketEmbeds() {
    if (!selectedGuild) return;
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/ticket-embeds`);
        if (!res.ok) return;
        currentTicketEmbeds = await res.json();
        loadTicketEmbed('buy');
    } catch (e) {
        console.error('Error loading all ticket embeds:', e);
    }
}

// ========================
// Developer Backup Functions
// ========================
async function createAndSendBackup() {
    const btn = document.getElementById('backupBtn');
    const status = document.getElementById('backupStatus');
    const targetUserId = document.getElementById('backupTargetUserId').value.trim();
    
    btn.disabled = true;
    btn.innerHTML = '⏳ جاري إنشاء النسخة الاحتياطية...';
    status.style.display = 'block';
    status.className = '';
    status.innerHTML = '⏳ جاري إنشاء وإرسال النسخة الاحتياطية...';
    
    try {
        const res = await fetch('/api/developer/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: targetUserId || undefined })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            status.className = 'success-message';
            status.innerHTML = `✅ تم إرسال النسخة الاحتياطية بنجاح! (${(data.size / 1024 / 1024).toFixed(2)} MB)`;
            showToast('تم إرسال النسخة الاحتياطية إلى الخاص', 'success');
        } else {
            status.className = 'error-message';
            status.innerHTML = `❌ ${data.error || 'فشل في إنشاء النسخة الاحتياطية'}`;
            showToast(data.error || 'فشل في إنشاء النسخة الاحتياطية', 'error');
        }
    } catch (e) {
        status.className = 'error-message';
        status.innerHTML = '❌ خطأ في الاتصال بالخادم';
        showToast('خطأ في الاتصال', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📦 إنشاء نسخة احتياطية وإرسالها';
    }
}

// Load ticket embeds when ticket settings page is shown
document.addEventListener('DOMContentLoaded', function() {
    const ticketSettingsLink = document.querySelector('[data-page="ticket-settings"]');
    if (ticketSettingsLink) {
        ticketSettingsLink.addEventListener('click', function() {
            setTimeout(loadAllTicketEmbeds, 100);
        });
    }
});

// Fix: Auto-load ticket embeds when ticket settings page is shown
const originalShowPage = window.showPage || function(){};
window.showPage = function(pageName) {
    if (typeof originalShowPage === 'function') {
        originalShowPage(pageName);
    }
    if (pageName === 'ticket-settings' && selectedGuild) {
        loadAllTicketEmbeds();
    }
};

// Load ticket embeds when guild is selected
document.addEventListener('guildSelected', function() {
    if (document.querySelector('#ticket-settings-page.active')) {
        loadAllTicketEmbeds();
    }
});

// ========== Prices Functions ==========
async function loadPrices() {
    if (!selectedGuild) return;
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/prices`);
        const prices = await res.json();
        
        // Shops
        document.getElementById('priceShopBasic').value = prices.shops?.basic || 0;
        document.getElementById('priceShopPremium').value = prices.shops?.premium || 0;
        document.getElementById('priceShopVip').value = prices.shops?.vip || 0;
        
        // Auctions
        document.getElementById('priceAuctionFee').value = prices.auctions?.fee || 0;
        document.getElementById('priceAuctionMinBid').value = prices.auctions?.minBid || 0;
        
        // Orders
        document.getElementById('priceOrderBasic').value = prices.orders?.basic || 0;
        document.getElementById('priceOrderExpress').value = prices.orders?.express || 0;
        
        // Roles
        document.getElementById('priceRoleMention').value = prices.roles?.mention || 0;
        document.getElementById('priceRoleCustom').value = prices.roles?.custom || 0;
        
        // Tickets
        document.getElementById('priceTicketSupport').value = prices.tickets?.support || 0;
        document.getElementById('priceTicketPriority').value = prices.tickets?.priority || 0;
    } catch (err) {
        console.error('Error loading prices:', err);
    }
}

async function savePrices() {
    if (!selectedGuild) return showNotification('يرجى اختيار سيرفر أولاً', 'error');
    
    const prices = {
        shops: {
            basic: parseInt(document.getElementById('priceShopBasic').value) || 0,
            premium: parseInt(document.getElementById('priceShopPremium').value) || 0,
            vip: parseInt(document.getElementById('priceShopVip').value) || 0
        },
        auctions: {
            fee: parseInt(document.getElementById('priceAuctionFee').value) || 0,
            minBid: parseInt(document.getElementById('priceAuctionMinBid').value) || 0
        },
        orders: {
            basic: parseInt(document.getElementById('priceOrderBasic').value) || 0,
            express: parseInt(document.getElementById('priceOrderExpress').value) || 0
        },
        roles: {
            mention: parseInt(document.getElementById('priceRoleMention').value) || 0,
            custom: parseInt(document.getElementById('priceRoleCustom').value) || 0
        },
        tickets: {
            support: parseInt(document.getElementById('priceTicketSupport').value) || 0,
            priority: parseInt(document.getElementById('priceTicketPriority').value) || 0
        }
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/prices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prices)
        });
        if (res.ok) {
            showNotification('تم حفظ الأسعار بنجاح ✅', 'success');
        } else {
            showNotification('فشل حفظ الأسعار', 'error');
        }
    } catch (err) {
        showNotification('خطأ في الاتصال', 'error');
    }
}

// ========== Rules Functions ==========
async function loadRules() {
    if (!selectedGuild) return;
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/rules`);
        const rules = await res.json();
        
        document.getElementById('rulesGeneral').value = rules.general || '';
        document.getElementById('rulesShops').value = rules.shops || '';
        document.getElementById('rulesAuctions').value = rules.auctions || '';
        document.getElementById('rulesOrders').value = rules.orders || '';
        document.getElementById('rulesRoles').value = rules.roles || '';
        document.getElementById('rulesTickets').value = rules.tickets || '';
    } catch (err) {
        console.error('Error loading rules:', err);
    }
}

async function saveRules() {
    if (!selectedGuild) return showNotification('يرجى اختيار سيرفر أولاً', 'error');
    
    const rules = {
        general: document.getElementById('rulesGeneral').value || '',
        shops: document.getElementById('rulesShops').value || '',
        auctions: document.getElementById('rulesAuctions').value || '',
        orders: document.getElementById('rulesOrders').value || '',
        roles: document.getElementById('rulesRoles').value || '',
        tickets: document.getElementById('rulesTickets').value || ''
    };
    
    try {
        const res = await fetch(`/api/guild/${selectedGuild}/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rules)
        });
        if (res.ok) {
            showNotification('تم حفظ القوانين بنجاح ✅', 'success');
        } else {
            showNotification('فشل حفظ القوانين', 'error');
        }
    } catch (err) {
        showNotification('خطأ في الاتصال', 'error');
    }
}

// Auto-load prices/rules when page is shown
const originalShowPageFn = window.showPage;
window.showPage = function(pageName) {
    if (typeof originalShowPageFn === 'function') {
        originalShowPageFn(pageName);
    }
    if (pageName === 'prices-settings' && selectedGuild) {
        loadPrices();
    } else if (pageName === 'rules-settings' && selectedGuild) {
        loadRules();
    }
};

// ========== Premium Bot Management Functions ==========

async function refreshPremiumBots() {
    try {
        const res = await fetch('/api/developer/premium-bots');
        if (!res.ok) {
            console.log('Not authorized for premium management');
            return;
        }
        
        const bots = await res.json();
        const tbody = document.getElementById('premiumBotsList');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Update statistics
        const now = new Date();
        const totalBots = bots.length;
        const runningBots = bots.filter(b => b.isRunning).length;
        const monthlyBots = bots.filter(b => b.subscriptionType === 'monthly').length;
        const lifetimeBots = bots.filter(b => b.subscriptionType === 'lifetime').length;
        
        document.getElementById('runningBotsCount').textContent = runningBots;
        document.getElementById('totalBotsCount').textContent = totalBots;
        document.getElementById('monthlyBotsCount').textContent = monthlyBots;
        document.getElementById('lifetimeBotsCount').textContent = lifetimeBots;
        
        // Render bots table
        bots.forEach(bot => {
            const isExpired = new Date(bot.expiryDate) < now;
            const expiryDate = new Date(bot.expiryDate);
            const statusClass = isExpired ? 'status-expired' : 'status-active';
            const statusText = isExpired ? '🔴 منتهي' : '🟢 نشط';
            const runningText = bot.isRunning ? '🟢 شغال' : '⚫ متوقف';
            const subscriptionText = bot.subscriptionType === 'monthly' ? '📅 شهري' : '♾️ دائم';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><code>${bot.invoiceCode}</code></td>
                <td>${bot.userId}</td>
                <td>${subscriptionText}</td>
                <td class="${statusClass}">${statusText}</td>
                <td>${runningText}${bot.uptime ? ' (' + bot.uptime + ')' : ''}</td>
                <td>${expiryDate.toLocaleDateString('ar-SA')}</td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        ${bot.isRunning 
                            ? `<button class="small-btn danger" onclick="stopBot('${bot.invoiceCode}')">⏹️</button>
                               <button class="small-btn warning" onclick="restartBot('${bot.invoiceCode}')">🔄</button>`
                            : `<button class="small-btn success" onclick="startBot('${bot.invoiceCode}')">▶️</button>`
                        }
                        <button class="small-btn danger" onclick="deleteBot('${bot.invoiceCode}')">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error('Error loading premium bots:', err);
    }
}

async function startBot(invoiceCode) {
    try {
        showNotification('جاري تشغيل البوت...', 'info');
        const res = await fetch(`/api/developer/premium-bots/${invoiceCode}/start`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('تم تشغيل البوت بنجاح ✅', 'success');
            await refreshPremiumBots();
        } else {
            showNotification(data.error || 'فشل تشغيل البوت', 'error');
        }
    } catch (err) {
        showNotification('خطأ في الاتصال', 'error');
    }
}

async function stopBot(invoiceCode) {
    try {
        const res = await fetch(`/api/developer/premium-bots/${invoiceCode}/stop`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('تم إيقاف البوت ✅', 'success');
            await refreshPremiumBots();
        } else {
            showNotification(data.error || 'فشل إيقاف البوت', 'error');
        }
    } catch (err) {
        showNotification('خطأ في الاتصال', 'error');
    }
}

async function restartBot(invoiceCode) {
    try {
        showNotification('جاري إعادة تشغيل البوت...', 'info');
        const res = await fetch(`/api/developer/premium-bots/${invoiceCode}/restart`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('تم إعادة تشغيل البوت ✅', 'success');
            await refreshPremiumBots();
        } else {
            showNotification(data.error || 'فشل إعادة تشغيل البوت', 'error');
        }
    } catch (err) {
        showNotification('خطأ في الاتصال', 'error');
    }
}

async function deleteBot(invoiceCode) {
    if (!confirm('هل أنت متأكد من حذف هذا البوت؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        return;
    }
    
    try {
        const res = await fetch(`/api/developer/premium-bots/${invoiceCode}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            showNotification('تم حذف البوت ✅', 'success');
            await refreshPremiumBots();
        } else {
            showNotification(data.error || 'فشل حذف البوت', 'error');
        }
    } catch (err) {
        showNotification('خطأ في الاتصال', 'error');
    }
}

async function startAllBots() {
    if (!confirm('هل أنت متأكد من تشغيل جميع البوتات؟')) return;
    
    showNotification('جاري تشغيل جميع البوتات...', 'info');
    
    try {
        const res = await fetch('/api/developer/premium-bots');
        const bots = await res.json();
        
        for (const bot of bots) {
            if (!bot.isRunning && bot.token) {
                await fetch(`/api/developer/premium-bots/${bot.invoiceCode}/start`, { method: 'POST' });
            }
        }
        
        showNotification('تم تشغيل البوتات ✅', 'success');
        await refreshPremiumBots();
    } catch (err) {
        showNotification('خطأ في تشغيل البوتات', 'error');
    }
}

async function stopAllBots() {
    if (!confirm('هل أنت متأكد من إيقاف جميع البوتات؟')) return;
    
    try {
        const res = await fetch('/api/developer/premium-bots');
        const bots = await res.json();
        
        for (const bot of bots) {
            if (bot.isRunning) {
                await fetch(`/api/developer/premium-bots/${bot.invoiceCode}/stop`, { method: 'POST' });
            }
        }
        
        showNotification('تم إيقاف جميع البوتات ✅', 'success');
        await refreshPremiumBots();
    } catch (err) {
        showNotification('خطأ في إيقاف البوتات', 'error');
    }
}

async function addNewPremiumBot() {
    const userId = document.getElementById('newBotUserId').value.trim();
    const subscriptionType = document.getElementById('newBotSubscriptionType').value;
    const serverId = document.getElementById('newBotServerId')?.value.trim() || null;
    const token = document.getElementById('newBotToken')?.value.trim() || null;
    
    if (!userId) {
        showNotification('يرجى إدخال آيدي المستخدم', 'error');
        return;
    }
    
    if (subscriptionType === 'lifetime' && !token) {
        showNotification('يرجى إدخال توكن البوت للاشتراك الدائم', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/developer/premium-bots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, subscriptionType, serverId, token })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showNotification('تم إضافة البوت بنجاح ✅', 'success');
            document.getElementById('newBotUserId').value = '';
            document.getElementById('newBotServerId').value = '';
            document.getElementById('newBotToken').value = '';
            await refreshPremiumBots();
        } else {
            showNotification(data.error || 'فشل إضافة البوت', 'error');
        }
    } catch (err) {
        showNotification('خطأ في الاتصال', 'error');
    }
}

// Toggle token/server ID fields based on subscription type
document.addEventListener('DOMContentLoaded', function() {
    const subscriptionSelect = document.getElementById('newBotSubscriptionType');
    if (subscriptionSelect) {
        subscriptionSelect.addEventListener('change', function() {
            const serverIdGroup = document.getElementById('serverIdGroup');
            const tokenGroup = document.getElementById('tokenGroup');
            
            if (this.value === 'monthly') {
                serverIdGroup.style.display = 'block';
                tokenGroup.style.display = 'none';
            } else {
                serverIdGroup.style.display = 'none';
                tokenGroup.style.display = 'block';
            }
        });
    }
});

// Load premium bots when premium-bots page is shown
const originalShowPageFn2 = window.showPage;
window.showPage = function(pageName) {
    if (typeof originalShowPageFn2 === 'function') {
        originalShowPageFn2(pageName);
    }
    if (pageName === 'premium-bots') {
        refreshPremiumBots();
    } else if (pageName === 'premium-dashboard') {
        loadPremiumStats();
    }
};

async function loadPremiumStats() {
    try {
        const res = await fetch('/api/developer/premium-stats');
        if (!res.ok) return;
        
        const stats = await res.json();
        
        document.getElementById('premiumActiveBots').textContent = stats.activeBots || 0;
        document.getElementById('premiumTotalSold').textContent = (stats.totalRevenue || 0).toLocaleString();
        document.getElementById('premiumBlacklistCount').textContent = stats.blacklistedUsers || 0;
    } catch (err) {
        console.error('Error loading premium stats:', err);
    }
}
