// ============================================
// TonCloude - Complete App Logic
// Single ADS Task with Daily Limit
// Link Validation for Bot/Channel
// ============================================

let currentUser = null;
let userBalance = { ton: 0, diamond: 0, gold: 0 };
let currentPage = 'earn';
let referralProcessed = false;

const tg = window.Telegram?.WebApp;

// ADS Config
const ADS_DAILY_LIMIT = 10;
const ADS_REWARD_GOLD = 250;
const ADS_REWARD_DIAMOND = 2;

// ============================================
// MONETAG ADS
// ============================================

async function showMonetag() {
    return new Promise((resolve, reject) => {
        if (typeof window.show_10378142 === 'function') {
            console.log('Monetag: Calling show_10378142()...');
            try {
                window.show_10378142();
                setTimeout(() => {
                    console.log('Monetag: Ad shown');
                    resolve(true);
                }, 3000);
            } catch (e) {
                console.error('Monetag: Ad error', e);
                reject(new Error('Ad failed'));
            }
        } else {
            console.error('Monetag: SDK not loaded');
            reject(new Error('Ad service unavailable'));
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    if (tg?.initDataUnsafe?.user) {
        currentUser = {
            id: tg.initDataUnsafe.user.id.toString(),
            username: tg.initDataUnsafe.user.username || 'User',
            firstName: tg.initDataUnsafe.user.first_name || 'User'
        };
        tg.expand();
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');
    } else {
        const stored = localStorage.getItem('tc_user');
        currentUser = stored ? JSON.parse(stored) : {
            id: 'not_app_' + Date.now(),
            username: 'TestUser',
            firstName: 'Test'
        };
        localStorage.setItem('tc_user', JSON.stringify(currentUser));
    }
    
    await initUserData();
    
    if (tg?.initDataUnsafe?.start_param && !referralProcessed) {
        referralProcessed = true;
        await DB.processReferral(tg.initDataUnsafe.start_param, currentUser.id);
    }
    
    loadPage('earn');
    console.log('Monetag SDK:', typeof window.show_10378142 === 'function' ? 'LOADED' : 'NOT LOADED');
}

async function initUserData() {
    try {
        let user = await DB.getUser(currentUser.id);
        
        if (!user) {
            await DB.createUser(currentUser.id, {
                username: currentUser.username,
                firstName: currentUser.firstName
            });
            user = await DB.getUser(currentUser.id);
            showToast('Welcome! +100 Gold bonus!', 'success');
        }
        
        updateBalanceFromUser(user);
        
        DB.onUserChange(currentUser.id, (data) => {
            updateBalanceFromUser(data);
        });
        
    } catch (e) {
        console.error('Init error:', e);
        showToast('Error loading data', 'error');
    }
}

function updateBalanceFromUser(user) {
    userBalance = {
        ton: user.ton || 0,
        diamond: user.diamond || 0,
        gold: user.gold || 0
    };
    updateBalanceUI();
}

function updateBalanceUI() {
    setText('tonBalance', userBalance.ton.toFixed(2));
    setText('diamondBalance', formatNum(userBalance.diamond));
    setText('goldBalance', formatNum(userBalance.gold));
    setText('walletTon', userBalance.ton.toFixed(2));
    setText('walletDiamond', formatNum(userBalance.diamond));
    setText('walletGold', formatNum(userBalance.gold));
    setText('modalGold', formatNum(userBalance.gold));
    setText('modalDiamond', formatNum(userBalance.diamond));
    setText('yourBalance', userBalance.ton.toFixed(2) + ' TON');
    
    const memo = document.getElementById('memoValue');
    if (memo) memo.value = currentUser.id;
}

// ============================================
// PAGE NAVIGATION
// ============================================

function showPage(page) {
    currentPage = page;
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const pageEl = document.getElementById(page + 'Page');
    if (pageEl) pageEl.classList.add('active');
    
    const navIndex = { earn: 0, ads: 1, nft: 2, refer: 3, wallet: 4 };
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems[navIndex[page]]) navItems[navIndex[page]].classList.add('active');
    
    loadPage(page);
}

async function loadPage(page) {
    switch(page) {
        case 'earn': await loadEarnPage(); break;
        case 'ads': await loadAdsPage(); break;
        case 'nft': break; // Static content
        case 'refer': await loadReferPage(); break;
        case 'wallet': await loadWalletPage(); break;
        case 'create': loadCreatePage(); break;
    }
}

// ============================================
// EARN PAGE
// ============================================

async function loadEarnPage() {
    await loadDailyTasks();
    await loadTasks('channel', 'channelTasks');
    await loadTasks('bot', 'botTasks');
    await loadTasks('other', 'otherTasks');
}

async function loadDailyTasks() {
    const container = document.getElementById('dailyTasks');
    if (!container) return;
    
    const tasks = [
        { id: 'dailyCheck', name: 'Daily Check', desc: 'Claim daily reward', reward: '+1000 Gold +10 💎', action: 'Claim' },
        { id: 'shareApp', name: 'Share App', desc: 'Share with friends', reward: '+500 Gold +5 💎', action: 'Share' },
        { id: 'checkUpdate', name: 'Check Update', desc: 'Visit updates channel', reward: '+300 Gold +3 💎', action: 'Check' }
    ];
    
    let html = '';
    for (const task of tasks) {
        const canClaim = await DB.canClaimDaily(currentUser.id, task.id);
        html += `
            <div class="task-card ${canClaim ? '' : 'completed'}" id="${task.id}Card">
                <div class="task-info">
                    <div class="task-icon">✓</div>
                    <div class="task-details">
                        <h3>${task.name}</h3>
                        <p>${task.desc}</p>
                    </div>
                </div>
                <div class="task-reward">
                    <span class="reward-amount">${task.reward}</span>
                    <button class="task-btn ${canClaim ? '' : 'claimed'}" 
                            id="${task.id}Btn"
                            onclick="claimDaily('${task.id}')" 
                            ${canClaim ? '' : 'disabled'}>
                        ${canClaim ? task.action : 'Done'}
                    </button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function claimDaily(taskType) {
    const btn = document.getElementById(taskType + 'Btn');
    
    try {
        const canClaim = await DB.canClaimDaily(currentUser.id, taskType);
        if (!canClaim) {
            showToast('Already claimed today!', 'error');
            return;
        }
        
        if (taskType === 'shareApp') {
            shareApp();
            return;
        }
        
        if (taskType === 'checkUpdate') {
            openLink('https://t.me/TonCloude_updates');
            if (btn) { btn.textContent = 'Verifying...'; btn.disabled = true; }
            showToast('Verifying...', 'info');
            await delay(3000);
            
            const rewards = await DB.claimDaily(currentUser.id, taskType);
            showToast(`+${rewards.gold} Gold +${rewards.diamond} Diamond!`, 'success');
            vibrate();
            await loadDailyTasks();
            return;
        }
        
        if (taskType === 'dailyCheck') {
            if (btn) { btn.textContent = 'Loading Ad...'; btn.disabled = true; }
            
            if (typeof window.show_10378142 === 'function') {
                showToast('Loading ad...', 'info');
                try {
                    await showMonetag();
                    const rewards = await DB.claimDaily(currentUser.id, taskType);
                    showToast(`+${rewards.gold} Gold +${rewards.diamond} Diamond!`, 'success');
                    vibrate();
                    await loadDailyTasks();
                } catch (adError) {
                    showToast('Ad failed, try again', 'error');
                    if (btn) { btn.textContent = 'Claim'; btn.disabled = false; }
                }
            } else {
                showToast('Ad service unavailable', 'error');
                if (btn) { btn.textContent = 'Claim'; btn.disabled = false; }
            }
        }
        
    } catch (e) {
        showToast(e.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Claim'; }
    }
}

function shareApp() {
    const link = `https://t.me/TonCloudeBot/TonCloude?startapp=${currentUser.id}`;
    const text = '🎮 Join TonCloude and earn crypto!\n💰 Complete tasks\n💎 Collect NFTs\n🎁 Get rewards!';
    
    if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
        navigator.share({ title: 'TonCloude', text, url: link });
    } else {
        copyToClipboard(link);
    }
    
    showToast('Verifying share...', 'info');
    
    setTimeout(async () => {
        try {
            const rewards = await DB.claimDaily(currentUser.id, 'shareApp');
            showToast(`+${rewards.gold} Gold +${rewards.diamond} Diamond!`, 'success');
            vibrate();
            await loadDailyTasks();
        } catch (e) {}
    }, 3000);
}

async function loadTasks(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<div class="loading"></div>';
    
    try {
        const tasks = await DB.getTasks(type);
        let html = '';
        
        for (const [id, task] of Object.entries(tasks)) {
            const completed = await DB.isTaskCompleted(id, currentUser.id);
            if (completed) continue;
            if (task.completedCount >= task.maximum) continue;
            
            const reward = Math.floor((task.tonAmount / task.maximum) * 1000);
            
            html += `
                <div class="task-card" id="task-${id}">
                    <div class="task-info">
                        <div class="task-icon">${type === 'channel' ? '📢' : type === 'bot' ? '🤖' : '🔗'}</div>
                        <div class="task-details">
                            <h3>${escapeHtml(task.title)}</h3>
                            <p>${task.completedCount || 0}/${task.maximum} users</p>
                        </div>
                    </div>
                    <div class="task-reward">
                        <span class="reward-amount">+${reward} Gold</span>
                        <button class="task-btn" onclick="doTask('${type}','${id}','${escapeHtml(task.link)}',${reward})">Start</button>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html || '<div class="empty-state"><p>No tasks available</p></div>';
    } catch (e) {
        container.innerHTML = '<div class="empty-state"><p>Error loading</p></div>';
    }
}

async function doTask(type, taskId, link, reward) {
    openLink(link);
    showToast('Verifying... 5 seconds', 'info');
    
    await delay(5000);
    
    try {
        await DB.completeTask(type, taskId, currentUser.id);
        await DB.updateBalance(currentUser.id, 'gold', reward, 'add');
        showToast(`+${reward} Gold!`, 'success');
        vibrate();
        
        const card = document.getElementById('task-' + taskId);
        if (card) {
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ============================================
// PROMO CODE
// ============================================

async function claimPromoCode() {
    const input = document.getElementById('promoCode');
    const code = input?.value.trim();
    
    if (!code) return showToast('Enter code', 'error');
    
    const btn = document.querySelector('.promo-card button');
    
    try {
        const promoRef = await database.ref('promoCodes/' + code.toUpperCase()).once('value');
        
        if (!promoRef.exists()) return showToast('Invalid code', 'error');
        
        const promo = promoRef.val();
        const usedSnap = await database.ref('promoCodes/' + code.toUpperCase() + '/usedBy/' + currentUser.id).once('value');
        if (usedSnap.exists()) return showToast('Already claimed', 'error');
        
        if ((promo.usedCount || 0) >= promo.limit) return showToast('Code expired', 'error');
        
        if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }
        
        if (typeof window.show_10378142 === 'function') {
            showToast('Code valid! Loading ad...', 'info');
            try {
                await showMonetag();
                const result = await DB.claimPromo(code, currentUser.id);
                
                let msg = 'Claimed: ';
                if (result.gold) msg += `+${result.gold} Gold `;
                if (result.diamond) msg += `+${result.diamond} Diamond `;
                if (result.ton) msg += `+${result.ton} TON`;
                
                showToast(msg, 'success');
                vibrate();
                input.value = '';
            } catch (adError) {
                showToast('Ad failed, try again', 'error');
            }
        } else {
            showToast('Ad service unavailable', 'error');
        }
        
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        if (btn) { btn.textContent = 'CLAIM'; btn.disabled = false; }
    }
}

// ============================================
// ADS PAGE (Single Task with 10 Daily Limit)
// ============================================

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

async function loadAdsPage() {
    const user = await DB.getUser(currentUser.id);
    const todayStr = getTodayStr();
    
    // Get today's ad count - reset if different day
    let adsWatched = 0;
    if (user.adsDate === todayStr) {
        adsWatched = user.adsCount || 0;
    } else {
        // Different day - reset count in database
        await DB.updateUser(currentUser.id, {
            adsDate: todayStr,
            adsCount: 0
        });
    }
    
    const remaining = Math.max(0, ADS_DAILY_LIMIT - adsWatched);
    const progressPercent = (adsWatched / ADS_DAILY_LIMIT) * 100;
    const earnedGold = adsWatched * ADS_REWARD_GOLD;
    const earnedDiamond = adsWatched * ADS_REWARD_DIAMOND;
    
    // Update UI
    setText('adsProgressText', `${adsWatched}/${ADS_DAILY_LIMIT}`);
    document.getElementById('adsProgressBar').style.width = `${progressPercent}%`;
    setText('adsTodayGold', `${earnedGold} Gold`);
    setText('adsTodayDiamond', `${earnedDiamond} 💎`);
    
    const btn = document.getElementById('watchAdBtn');
    const note = document.getElementById('adsNote');
    
    if (adsWatched >= ADS_DAILY_LIMIT) {
        btn.disabled = true;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Limit Reached`;
        note.textContent = 'Come back tomorrow for more ads!';
        note.classList.add('limit-reached');
    } else {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Watch Ad`;
        note.textContent = `You can watch ${remaining} more ads today`;
        note.classList.remove('limit-reached');
    }
}

async function watchAd() {
    const user = await DB.getUser(currentUser.id);
    const todayStr = getTodayStr();
    
    let adsWatched = 0;
    if (user.adsDate === todayStr) {
        adsWatched = user.adsCount || 0;
    }
    
    if (adsWatched >= ADS_DAILY_LIMIT) {
        showToast('Daily limit reached!', 'error');
        return;
    }
    
    const btn = document.getElementById('watchAdBtn');
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Loading...`;
    
    if (typeof window.show_10378142 === 'function') {
        showToast('Loading ad...', 'info');
        
        try {
            await showMonetag();
            
            // Update ads count and give rewards
            const newCount = adsWatched + 1;
            await DB.updateUser(currentUser.id, {
                adsDate: todayStr,
                adsCount: newCount,
                gold: (user.gold || 0) + ADS_REWARD_GOLD,
                diamond: (user.diamond || 0) + ADS_REWARD_DIAMOND
            });
            
            showToast(`+${ADS_REWARD_GOLD} Gold +${ADS_REWARD_DIAMOND} Diamond!`, 'success');
            vibrate();
            
            // Reload ads page UI
            await loadAdsPage();
            
        } catch (adError) {
            console.error('Ad error:', adError);
            showToast('Ad failed, try again', 'error');
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Watch Ad`;
        }
    } else {
        showToast('Ad service unavailable', 'error');
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Watch Ad`;
    }
}

// ============================================
// NFT PAGE
// ============================================

function switchNftTab(tab) {
    document.querySelectorAll('.nft-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nft-tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'gift') {
        document.querySelector('.nft-tab:first-child').classList.add('active');
        document.getElementById('giftTabContent').classList.add('active');
    } else {
        document.querySelector('.nft-tab:last-child').classList.add('active');
        document.getElementById('nftTabContent').classList.add('active');
    }
}

// ============================================
// REFER PAGE
// ============================================

async function loadReferPage() {
    const link = `https://t.me/TonCloudeBot/TonCloude?startapp=${currentUser.id}`;
    setText('referralLink', link, true);
    
    const refs = await DB.getReferrals(currentUser.id);
    const count = Object.keys(refs).length;
    
    setText('totalReferrals', count);
    setText('earnedFromReferrals', formatNum(count * 1000));
    
    const list = document.getElementById('referralList');
    if (!list) return;
    
    if (count === 0) {
        list.innerHTML = '<div class="empty-state"><p>No referrals yet</p></div>';
        return;
    }
    
    let html = '';
    let i = 0;
    for (const userId of Object.values(refs)) {
        i++;
        const user = await DB.getUser(userId);
        html += `
            <div class="referral-item">
                <div class="referral-avatar">👤</div>
                <div class="referral-info">
                    <h3>${user?.firstName || 'User'}</h3>
                    <p>Referral #${i}</p>
                </div>
                <span class="referral-reward">+1000 Gold +10 💎</span>
            </div>
        `;
    }
    list.innerHTML = html;
}

function copyReferralLink() {
    const input = document.getElementById('referralLink');
    if (input) copyToClipboard(input.value);
}

function shareReferralLink() {
    const link = `https://t.me/TonCloudeBot/TonCloude?startapp=${currentUser.id}`;
    const text = '🎮 Join TonCloude!\n💰 Earn Gold & Diamond\n🎁 Get 100 Gold bonus!';
    
    if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else {
        copyToClipboard(link);
    }
}

// ============================================
// WALLET PAGE
// ============================================

async function loadWalletPage() {
    updateBalanceUI();
    await loadWithdrawHistory();
}

async function loadWithdrawHistory() {
    const container = document.getElementById('transactionList');
    if (!container) return;
    
    const user = await DB.getUser(currentUser.id);
    const wds = user?.withdrawals || {};
    
    if (Object.keys(wds).length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No history</p></div>';
        return;
    }
    
    const sorted = Object.entries(wds).sort((a, b) => b[1].createdAt - a[1].createdAt);
    
    let html = '';
    for (const [id, wd] of sorted) {
        const statusClass = wd.status;
        const statusIcon = wd.status === 'paid' ? '✓' : wd.status === 'rejected' ? '✕' : '⏳';
        
        html += `
            <div class="transaction-item">
                <div class="transaction-icon ${statusClass}">${statusIcon}</div>
                <div class="transaction-info">
                    <h3>Withdraw ${formatNum(wd.goldAmount)} Gold</h3>
                    <p>Fee: ${formatNum(wd.diamondFee)} 💎</p>
                </div>
                <span class="status-badge ${statusClass}">${wd.status.toUpperCase()}</span>
            </div>
        `;
    }
    container.innerHTML = html;
}

function calculateFee() {
    const amount = parseInt(document.getElementById('withdrawGoldAmount')?.value) || 0;
    const fee = Math.floor(amount / 100000) * 20000;
    
    setText('wdGold', formatNum(amount));
    setText('wdFee', formatNum(fee) + ' Diamond');
}

async function processWithdraw() {
    const amount = parseInt(document.getElementById('withdrawGoldAmount')?.value) || 0;
    const address = document.getElementById('withdrawAddress')?.value.trim();
    
    if (!address || address.length < 10) return showToast('Enter valid address', 'error');
    if (amount < 100000) return showToast('Min 100,000 Gold', 'error');
    
    try {
        await DB.createWithdraw(currentUser.id, amount, address);
        showToast('Withdrawal submitted!', 'success');
        vibrate();
        closeModal('withdrawModal');
        document.getElementById('withdrawGoldAmount').value = '';
        document.getElementById('withdrawAddress').value = '';
        await loadWithdrawHistory();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ============================================
// CREATE TASK PAGE (with Link Validation)
// ============================================

function loadCreatePage() {
    updateBalanceUI();
    calculateMaxUsers();
    updateLinkPlaceholder();
}

function updateLinkPlaceholder() {
    const type = document.querySelector('input[name="taskType"]:checked')?.value;
    const linkInput = document.getElementById('taskLink');
    const linkHint = document.getElementById('linkHint');
    
    if (type === 'channel') {
        linkInput.placeholder = 'https://t.me/channelname';
        linkHint.textContent = 'Link must be: https://t.me/channelname';
    } else if (type === 'bot') {
        linkInput.placeholder = 'https://t.me/botusername';
        linkHint.textContent = 'Link must be: https://t.me/botusername';
    } else {
        linkInput.placeholder = 'https://example.com';
        linkHint.textContent = 'Any valid URL is accepted';
    }
    
    // Re-validate if there's already a value
    if (linkInput.value) {
        validateLink();
    }
}

function validateLink() {
    const type = document.querySelector('input[name="taskType"]:checked')?.value;
    const linkInput = document.getElementById('taskLink');
    const linkError = document.getElementById('linkError');
    const link = linkInput.value.trim();
    
    // Reset styles
    linkInput.classList.remove('error', 'valid');
    linkError.classList.remove('show');
    linkError.textContent = '';
    
    if (!link) return true;
    
    // For channel and bot, must start with https://t.me/
    if (type === 'channel' || type === 'bot') {
        if (!link.startsWith('https://t.me/')) {
            linkInput.classList.add('error');
            linkError.textContent = 'Link must start with https://t.me/';
            linkError.classList.add('show');
            return false;
        }
        
        // Check if there's a username after t.me/
        const username = link.replace('https://t.me/', '');
        if (!username || username.length < 3) {
            linkInput.classList.add('error');
            linkError.textContent = type === 'channel' ? 'Enter valid channel username' : 'Enter valid bot username';
            linkError.classList.add('show');
            return false;
        }
        
        linkInput.classList.add('valid');
        return true;
    }
    
    // For other type, just check if it's a valid URL
    try {
        new URL(link);
        linkInput.classList.add('valid');
        return true;
    } catch (e) {
        linkInput.classList.add('error');
        linkError.textContent = 'Enter a valid URL';
        linkError.classList.add('show');
        return false;
    }
}

function calculateMaxUsers() {
    const ton = parseFloat(document.getElementById('tonAmount')?.value) || 0;
    const maxUsers = Math.floor(ton * 1000);
    
    setText('maxUsers', maxUsers || '', true);
    setText('taskCost', ton.toFixed(2) + ' TON');
    
    const after = userBalance.ton - ton;
    const afterEl = document.getElementById('afterBalance');
    if (afterEl) {
        afterEl.textContent = after.toFixed(2) + ' TON';
        afterEl.style.color = after < 0 ? '#ff5252' : '#00c853';
    }
    
    const btn = document.getElementById('createBtn');
    if (btn) btn.disabled = after < 0 || ton < 0.5;
}

async function submitTask(e) {
    e.preventDefault();
    
    const type = document.querySelector('input[name="taskType"]:checked')?.value;
    const title = document.getElementById('taskTitle')?.value.trim();
    const link = document.getElementById('taskLink')?.value.trim();
    const ton = parseFloat(document.getElementById('tonAmount')?.value) || 0;
    const maxUsers = Math.floor(ton * 1000);
    
    // Validate title
    if (!title) return showToast('Enter title', 'error');
    const wordCount = title.split(/\s+/).filter(w => w).length;
    if (wordCount > 10) return showToast('Max 10 words in title', 'error');
    
    // Validate link
    if (!link) return showToast('Enter link', 'error');
    if (!validateLink()) {
        showToast('Invalid link format', 'error');
        return;
    }
    
    // Validate TON
    if (ton < 0.5) return showToast('Min 0.5 TON', 'error');
    if (ton > userBalance.ton) return showToast('Not enough TON', 'error');
    
    const btn = document.getElementById('createBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    
    try {
        await DB.updateBalance(currentUser.id, 'ton', ton, 'subtract');
        await DB.createTask(type, {
            title,
            link,
            tonAmount: ton,
            maximum: maxUsers,
            createdBy: currentUser.id
        });
        
        showToast('Task created!', 'success');
        vibrate();
        
        document.getElementById('createTaskForm').reset();
        showPage('earn');
    } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Create Task';
    }
}

// ============================================
// MODALS & UI
// ============================================

function showModal(id) {
    document.getElementById(id)?.classList.add('active');
    if (id === 'withdrawModal') {
        setText('modalGold', formatNum(userBalance.gold));
        setText('modalDiamond', formatNum(userBalance.diamond));
    }
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

document.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    vibrate();
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function vibrate() {
    navigator.vibrate?.(50);
    tg?.HapticFeedback?.impactOccurred?.('medium');
}

// ============================================
// UTILITIES
// ============================================

function setText(id, val, isInput = false) {
    const el = document.getElementById(id);
    if (el) isInput ? el.value = val : el.textContent = val;
}

function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(() => showToast('Copied!', 'success'))
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Copied!', 'success');
        });
}

function copyText(id) {
    const el = document.getElementById(id);
    if (el) copyToClipboard(el.value);
}

function openLink(url) {
    if (tg?.openLink) tg.openLink(url);
    else if (tg?.openTelegramLink && url.includes('t.me')) tg.openTelegramLink(url);
    else window.open(url, '_blank');
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Global exports
window.showPage = showPage;
window.claimDaily = claimDaily;
window.claimPromoCode = claimPromoCode;
window.doTask = doTask;
window.watchAd = watchAd;
window.switchNftTab = switchNftTab;
window.copyReferralLink = copyReferralLink;
window.shareReferralLink = shareReferralLink;
window.calculateFee = calculateFee;
window.processWithdraw = processWithdraw;
window.calculateMaxUsers = calculateMaxUsers;
window.updateLinkPlaceholder = updateLinkPlaceholder;
window.validateLink = validateLink;
window.submitTask = submitTask;
window.showModal = showModal;
window.closeModal = closeModal;
window.copyText = copyText;
