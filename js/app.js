// ============================================
// TonCloude - Complete App Logic
// WITH AUTO DEPOSIT SYSTEM
// ============================================

var currentUser = null;
var userBalance = { ton: 0, diamond: 0, gold: 0 };
var currentPage = 'earn';
var referralProcessed = false;

var tg = window.Telegram ? window.Telegram.WebApp : null;

var ADS_DAILY_LIMIT = 10;
var ADS_REWARD_GOLD = 250;
var ADS_REWARD_DIAMOND = 2;

// ============================================
// MONETAG ADS
// ============================================

function showMonetag() {
    return new Promise(function(resolve, reject) {
        if (typeof window.show_10378142 === 'function') {
            console.log('Monetag: Calling show_10378142()...');
            try {
                window.show_10378142();
                setTimeout(function() {
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

function initApp() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        currentUser = {
            id: tg.initDataUnsafe.user.id.toString(),
            username: tg.initDataUnsafe.user.username || 'User',
            firstName: tg.initDataUnsafe.user.first_name || 'User'
        };
        tg.expand();
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');
    } else {
        var stored = localStorage.getItem('tc_user');
        if (stored) {
            currentUser = JSON.parse(stored);
        } else {
            currentUser = {
                id: 'test_' + Date.now(),
                username: 'TestUser',
                firstName: 'Test'
            };
        }
        localStorage.setItem('tc_user', JSON.stringify(currentUser));
    }
    
    initUserData();
    
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param && !referralProcessed) {
        referralProcessed = true;
        DB.processReferral(tg.initDataUnsafe.start_param, currentUser.id);
    }
    
    showPage('earn');
    console.log('Monetag SDK:', typeof window.show_10378142 === 'function' ? 'LOADED' : 'NOT LOADED');
}

function initUserData() {
    DB.getUser(currentUser.id).then(function(user) {
        if (!user) {
            DB.createUser(currentUser.id, {
                username: currentUser.username,
                firstName: currentUser.firstName
            }).then(function() {
                return DB.getUser(currentUser.id);
            }).then(function(newUser) {
                updateBalanceFromUser(newUser);
                showToast('Welcome! +100 Gold bonus!', 'success');
            });
        } else {
            updateBalanceFromUser(user);
        }
        
        DB.onUserChange(currentUser.id, function(data) {
            updateBalanceFromUser(data);
        });
    }).catch(function(e) {
        console.error('Init error:', e);
        showToast('Error loading data', 'error');
    });
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
    
    var memo = document.getElementById('memoValue');
    var memoMain = document.getElementById('memoValueMain');
    if (memo) memo.value = currentUser.id;
    if (memoMain) memoMain.value = currentUser.id;
}

// ============================================
// PAGE NAVIGATION
// ============================================

function showPage(page) {
    currentPage = page;
    
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove('active');
    }
    
    var navItems = document.querySelectorAll('.nav-item');
    for (var j = 0; j < navItems.length; j++) {
        navItems[j].classList.remove('active');
    }
    
    var pageEl = document.getElementById(page + 'Page');
    if (pageEl) pageEl.classList.add('active');
    
    var navIndex = { earn: 0, ads: 1, nft: 2, refer: 3, wallet: 4 };
    if (navItems[navIndex[page]]) navItems[navIndex[page]].classList.add('active');
    
    loadPage(page);
}

function loadPage(page) {
    switch(page) {
        case 'earn': loadEarnPage(); break;
        case 'ads': loadAdsPage(); break;
        case 'nft': break;
        case 'refer': loadReferPage(); break;
        case 'wallet': loadWalletPage(); break;
        case 'create': loadCreatePage(); break;
        case 'promote': loadPromotePage(); break;
    }
}

// ============================================
// EARN PAGE
// ============================================

function loadEarnPage() {
    loadDailyTasks();
    loadTasks('channel', 'channelTasks');
    loadTasks('bot', 'botTasks');
    loadTasks('other', 'otherTasks');
}

function loadDailyTasks() {
    var container = document.getElementById('dailyTasks');
    if (!container) return;
    
    var tasks = [
        { id: 'dailyCheck', name: 'Daily Check', desc: 'Claim daily reward', reward: '+1000 Gold +10 💎', action: 'Claim' },
        { id: 'shareApp', name: 'Share App', desc: 'Share with friends', reward: '+500 Gold +5 💎', action: 'Share' },
        { id: 'checkUpdate', name: 'Check Update', desc: 'Visit updates channel', reward: '+300 Gold +3 💎', action: 'Check' }
    ];
    
    var promises = tasks.map(function(task) {
        return DB.canClaimDaily(currentUser.id, task.id).then(function(canClaim) {
            return { task: task, canClaim: canClaim };
        });
    });
    
    Promise.all(promises).then(function(results) {
        var html = '';
        results.forEach(function(result) {
            var task = result.task;
            var canClaim = result.canClaim;
            html += '<div class="task-card ' + (canClaim ? '' : 'completed') + '" id="' + task.id + 'Card">' +
                '<div class="task-info">' +
                    '<div class="task-icon">✓</div>' +
                    '<div class="task-details">' +
                        '<h3>' + task.name + '</h3>' +
                        '<p>' + task.desc + '</p>' +
                    '</div>' +
                '</div>' +
                '<div class="task-reward">' +
                    '<span class="reward-amount">' + task.reward + '</span>' +
                    '<button class="task-btn ' + (canClaim ? '' : 'claimed') + '" ' +
                            'id="' + task.id + 'Btn" ' +
                            'onclick="claimDaily(\'' + task.id + '\')" ' +
                            (canClaim ? '' : 'disabled') + '>' +
                        (canClaim ? task.action : 'Done') +
                    '</button>' +
                '</div>' +
            '</div>';
        });
        container.innerHTML = html;
    });
}

function claimDaily(taskType) {
    var btn = document.getElementById(taskType + 'Btn');
    
    DB.canClaimDaily(currentUser.id, taskType).then(function(canClaim) {
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
            
            setTimeout(function() {
                DB.claimDaily(currentUser.id, taskType).then(function(rewards) {
                    showToast('+' + rewards.gold + ' Gold +' + rewards.diamond + ' Diamond!', 'success');
                    vibrate();
                    loadDailyTasks();
                });
            }, 3000);
            return;
        }
        
        if (taskType === 'dailyCheck') {
            if (btn) { btn.textContent = 'Loading Ad...'; btn.disabled = true; }
            
            if (typeof window.show_10378142 === 'function') {
                showToast('Loading ad...', 'info');
                showMonetag().then(function() {
                    return DB.claimDaily(currentUser.id, taskType);
                }).then(function(rewards) {
                    showToast('+' + rewards.gold + ' Gold +' + rewards.diamond + ' Diamond!', 'success');
                    vibrate();
                    loadDailyTasks();
                }).catch(function() {
                    showToast('Ad failed, try again', 'error');
                    if (btn) { btn.textContent = 'Claim'; btn.disabled = false; }
                });
            } else {
                showToast('Ad service unavailable', 'error');
                if (btn) { btn.textContent = 'Claim'; btn.disabled = false; }
            }
        }
    }).catch(function(e) {
        showToast(e.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Claim'; }
    });
}

function shareApp() {
    var link = 'https://t.me/TonCloudeBot/TonCloude?startapp=' + currentUser.id;
    var text = '🎮 Join TonCloude and earn crypto!\n💰 Complete tasks\n💎 Collect NFTs\n🎁 Get rewards!';
    
    if (tg && tg.openTelegramLink) {
        tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text));
    } else if (navigator.share) {
        navigator.share({ title: 'TonCloude', text: text, url: link });
    } else {
        copyToClipboard(link);
    }
    
    showToast('Verifying share...', 'info');
    
    setTimeout(function() {
        DB.claimDaily(currentUser.id, 'shareApp').then(function(rewards) {
            showToast('+' + rewards.gold + ' Gold +' + rewards.diamond + ' Diamond!', 'success');
            vibrate();
            loadDailyTasks();
        }).catch(function() {});
    }, 3000);
}

function loadTasks(type, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<div class="loading"></div>';
    
    DB.getTasks(type).then(function(tasks) {
        var taskIds = Object.keys(tasks);
        if (taskIds.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No tasks available</p></div>';
            return;
        }
        
        var promises = taskIds.map(function(id) {
            return DB.isTaskCompleted(id, currentUser.id).then(function(completed) {
                return { id: id, task: tasks[id], completed: completed };
            });
        });
        
        Promise.all(promises).then(function(results) {
            var html = '';
            results.forEach(function(result) {
                if (result.completed) return;
                if (result.task.completedCount >= result.task.maximum) return;
                
                var reward = Math.floor((result.task.tonAmount / result.task.maximum) * 1000);
                var icon = type === 'channel' ? '📢' : type === 'bot' ? '🤖' : '🔗';
                
                html += '<div class="task-card" id="task-' + result.id + '">' +
                    '<div class="task-info">' +
                        '<div class="task-icon">' + icon + '</div>' +
                        '<div class="task-details">' +
                            '<h3>' + escapeHtml(result.task.title) + '</h3>' +
                            '<p>' + (result.task.completedCount || 0) + '/' + result.task.maximum + ' users</p>' +
                        '</div>' +
                    '</div>' +
                    '<div class="task-reward">' +
                        '<span class="reward-amount">+' + reward + ' Gold</span>' +
                        '<button class="task-btn" onclick="doTask(\'' + type + '\',\'' + result.id + '\',\'' + escapeHtml(result.task.link) + '\',' + reward + ')">Start</button>' +
                    '</div>' +
                '</div>';
            });
            
            container.innerHTML = html || '<div class="empty-state"><p>No tasks available</p></div>';
        });
    }).catch(function() {
        container.innerHTML = '<div class="empty-state"><p>Error loading</p></div>';
    });
}

function doTask(type, taskId, link, reward) {
    openLink(link);
    showToast('Verifying... 5 seconds', 'info');
    
    setTimeout(function() {
        DB.completeTask(type, taskId, currentUser.id).then(function() {
            return DB.updateBalance(currentUser.id, 'gold', reward, 'add');
        }).then(function() {
            showToast('+' + reward + ' Gold!', 'success');
            vibrate();
            
            var card = document.getElementById('task-' + taskId);
            if (card) {
                card.style.opacity = '0';
                setTimeout(function() { card.remove(); }, 300);
            }
        }).catch(function(e) {
            showToast(e.message, 'error');
        });
    }, 5000);
}

// ============================================
// PROMO CODE
// ============================================

function claimPromoCode() {
    var input = document.getElementById('promoCode');
    var code = input ? input.value.trim() : '';
    
    if (!code) {
        showToast('Enter code', 'error');
        return;
    }
    
    var btn = document.querySelector('.promo-card button');
    
    database.ref('promoCodes/' + code.toUpperCase()).once('value').then(function(snap) {
        if (!snap.exists()) {
            showToast('Invalid code', 'error');
            return;
        }
        
        var promo = snap.val();
        return database.ref('promoCodes/' + code.toUpperCase() + '/usedBy/' + currentUser.id).once('value').then(function(usedSnap) {
            if (usedSnap.exists()) {
                showToast('Already claimed', 'error');
                return;
            }
            
            if ((promo.usedCount || 0) >= promo.limit) {
                showToast('Code expired', 'error');
                return;
            }
            
            if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }
            
            if (typeof window.show_10378142 === 'function') {
                showToast('Code valid! Loading ad...', 'info');
                showMonetag().then(function() {
                    return DB.claimPromo(code, currentUser.id);
                }).then(function(result) {
                    var msg = 'Claimed: ';
                    if (result.gold) msg += '+' + result.gold + ' Gold ';
                    if (result.diamond) msg += '+' + result.diamond + ' Diamond ';
                    if (result.ton) msg += '+' + result.ton + ' TON';
                    
                    showToast(msg, 'success');
                    vibrate();
                    input.value = '';
                }).catch(function() {
                    showToast('Ad failed, try again', 'error');
                }).finally(function() {
                    if (btn) { btn.textContent = 'CLAIM'; btn.disabled = false; }
                });
            } else {
                showToast('Ad service unavailable', 'error');
                if (btn) { btn.textContent = 'CLAIM'; btn.disabled = false; }
            }
        });
    }).catch(function(e) {
        showToast(e.message, 'error');
        if (btn) { btn.textContent = 'CLAIM'; btn.disabled = false; }
    });
}

// ============================================
// ADS PAGE
// ============================================

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function loadAdsPage() {
    DB.getUser(currentUser.id).then(function(user) {
        var todayStr = getTodayStr();
        var adsWatched = 0;
        
        if (user.adsDate === todayStr) {
            adsWatched = user.adsCount || 0;
        } else {
            DB.updateUser(currentUser.id, {
                adsDate: todayStr,
                adsCount: 0
            });
        }
        
        var remaining = Math.max(0, ADS_DAILY_LIMIT - adsWatched);
        var progressPercent = (adsWatched / ADS_DAILY_LIMIT) * 100;
        var earnedGold = adsWatched * ADS_REWARD_GOLD;
        var earnedDiamond = adsWatched * ADS_REWARD_DIAMOND;
        
        setText('adsProgressText', adsWatched + '/' + ADS_DAILY_LIMIT);
        document.getElementById('adsProgressBar').style.width = progressPercent + '%';
        setText('adsTodayGold', earnedGold + ' Gold');
        setText('adsTodayDiamond', earnedDiamond + ' 💎');
        
        var btn = document.getElementById('watchAdBtn');
        var note = document.getElementById('adsNote');
        
        if (adsWatched >= ADS_DAILY_LIMIT) {
            btn.disabled = true;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Limit Reached';
            note.textContent = 'Come back tomorrow for more ads!';
            note.classList.add('limit-reached');
        } else {
            btn.disabled = false;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Watch Ad';
            note.textContent = 'You can watch ' + remaining + ' more ads today';
            note.classList.remove('limit-reached');
        }
    });
}

function watchAd() {
    DB.getUser(currentUser.id).then(function(user) {
        var todayStr = getTodayStr();
        var adsWatched = 0;
        
        if (user.adsDate === todayStr) {
            adsWatched = user.adsCount || 0;
        }
        
        if (adsWatched >= ADS_DAILY_LIMIT) {
            showToast('Daily limit reached!', 'error');
            return;
        }
        
        var btn = document.getElementById('watchAdBtn');
        btn.disabled = true;
        btn.classList.add('loading');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Loading...';
        
        if (typeof window.show_10378142 === 'function') {
            showToast('Loading ad...', 'info');
            
            showMonetag().then(function() {
                var newCount = adsWatched + 1;
                return DB.updateUser(currentUser.id, {
                    adsDate: todayStr,
                    adsCount: newCount,
                    gold: (user.gold || 0) + ADS_REWARD_GOLD,
                    diamond: (user.diamond || 0) + ADS_REWARD_DIAMOND
                });
            }).then(function() {
                showToast('+' + ADS_REWARD_GOLD + ' Gold +' + ADS_REWARD_DIAMOND + ' Diamond!', 'success');
                vibrate();
                loadAdsPage();
            }).catch(function() {
                showToast('Ad failed, try again', 'error');
                resetAdButton();
            });
        } else {
            showToast('Ad service unavailable', 'error');
            resetAdButton();
        }
    });
}

function resetAdButton() {
    var btn = document.getElementById('watchAdBtn');
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Watch Ad';
}

// ============================================
// NFT PAGE
// ============================================

function switchNftTab(tab) {
    var tabs = document.querySelectorAll('.nft-tab');
    var contents = document.querySelectorAll('.nft-tab-content');
    
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    for (var j = 0; j < contents.length; j++) {
        contents[j].classList.remove('active');
    }
    
    if (tab === 'gift') {
        tabs[0].classList.add('active');
        document.getElementById('giftTabContent').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('nftTabContent').classList.add('active');
    }
}

// ============================================
// REFER PAGE
// ============================================

function loadReferPage() {
    var link = 'https://t.me/TonCloudeBot/TonCloude?startapp=' + currentUser.id;
    setText('referralLink', link, true);
    
    DB.getReferrals(currentUser.id).then(function(refs) {
        var count = Object.keys(refs).length;
        
        setText('totalReferrals', count);
        setText('earnedFromReferrals', formatNum(count * 1000));
        
        var list = document.getElementById('referralList');
        if (!list) return;
        
        if (count === 0) {
            list.innerHTML = '<div class="empty-state"><p>No referrals yet</p></div>';
            return;
        }
        
        var userIds = Object.values(refs);
        var promises = userIds.map(function(userId, index) {
            return DB.getUser(userId).then(function(user) {
                return { user: user, index: index + 1 };
            });
        });
        
        Promise.all(promises).then(function(results) {
            var html = '';
            results.forEach(function(result) {
                html += '<div class="referral-item">' +
                    '<div class="referral-avatar">👤</div>' +
                    '<div class="referral-info">' +
                        '<h3>' + (result.user ? result.user.firstName : 'User') + '</h3>' +
                        '<p>Referral #' + result.index + '</p>' +
                    '</div>' +
                    '<span class="referral-reward">+1000 Gold +10 💎</span>' +
                '</div>';
            });
            list.innerHTML = html;
        });
    });
}

function copyReferralLink() {
    var input = document.getElementById('referralLink');
    if (input) copyToClipboard(input.value);
}

function shareReferralLink() {
    var link = 'https://t.me/TonCloudeBot/TonCloude?startapp=' + currentUser.id;
    var text = '🎮 Join TonCloude!\n💰 Earn Gold & Diamond\n🎁 Get 100 Gold bonus!';
    
    if (tg && tg.openTelegramLink) {
        tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text));
    } else {
        copyToClipboard(link);
    }
}

// ============================================
// WALLET PAGE
// ============================================

function loadWalletPage() {
    updateBalanceUI();
    loadDepositHistory();
    loadWithdrawHistory();
}

function loadDepositHistory() {
    var container = document.getElementById('depositList');
    if (!container) return;
    
    DB.getUserDeposits(currentUser.id).then(function(deposits) {
        if (Object.keys(deposits).length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No deposits yet</p></div>';
            return;
        }
        
        var sorted = Object.entries(deposits).sort(function(a, b) {
            return b[1].createdAt - a[1].createdAt;
        });
        
        var html = '';
        sorted.forEach(function(entry) {
            var dep = entry[1];
            var date = new Date(dep.createdAt).toLocaleDateString();
            var time = new Date(dep.createdAt).toLocaleTimeString();
            
            html += '<div class="transaction-item">' +
                '<div class="transaction-icon deposit">💰</div>' +
                '<div class="transaction-info">' +
                    '<h3>+' + dep.amount.toFixed(4) + ' TON</h3>' +
                    '<p>' + date + ' ' + time + '</p>' +
                '</div>' +
                '<span class="status-badge completed">COMPLETED</span>' +
            '</div>';
        });
        container.innerHTML = html;
    });
}

function loadWithdrawHistory() {
    var container = document.getElementById('transactionList');
    if (!container) return;
    
    DB.getUser(currentUser.id).then(function(user) {
        var wds = user && user.withdrawals ? user.withdrawals : {};
        
        if (Object.keys(wds).length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No history</p></div>';
            return;
        }
        
        var sorted = Object.entries(wds).sort(function(a, b) {
            return b[1].createdAt - a[1].createdAt;
        });
        
        var html = '';
        sorted.forEach(function(entry) {
            var wd = entry[1];
            var statusClass = wd.status;
            var statusIcon = wd.status === 'paid' ? '✓' : wd.status === 'rejected' ? '✕' : '⏳';
            
            html += '<div class="transaction-item">' +
                '<div class="transaction-icon ' + statusClass + '">' + statusIcon + '</div>' +
                '<div class="transaction-info">' +
                    '<h3>Withdraw ' + formatNum(wd.goldAmount) + ' Gold</h3>' +
                    '<p>Fee: ' + formatNum(wd.diamondFee) + ' 💎</p>' +
                '</div>' +
                '<span class="status-badge ' + statusClass + '">' + wd.status.toUpperCase() + '</span>' +
            '</div>';
        });
        container.innerHTML = html;
    });
}

function calculateFee() {
    var amountInput = document.getElementById('withdrawGoldAmount');
    var amount = amountInput ? parseInt(amountInput.value) || 0 : 0;
    var fee = Math.floor(amount / 100000) * 20000;
    
    setText('wdGold', formatNum(amount));
    setText('wdFee', formatNum(fee) + ' Diamond');
}

function processWithdraw() {
    var amountInput = document.getElementById('withdrawGoldAmount');
    var addressInput = document.getElementById('withdrawAddress');
    var amount = amountInput ? parseInt(amountInput.value) || 0 : 0;
    var address = addressInput ? addressInput.value.trim() : '';
    
    if (!address || address.length < 10) {
        showToast('Enter valid address', 'error');
        return;
    }
    if (amount < 100000) {
        showToast('Min 100,000 Gold', 'error');
        return;
    }
    
    DB.createWithdraw(currentUser.id, amount, address).then(function() {
        showToast('Withdrawal submitted!', 'success');
        vibrate();
        closeModal('withdrawModal');
        amountInput.value = '';
        addressInput.value = '';
        loadWithdrawHistory();
    }).catch(function(e) {
        showToast(e.message, 'error');
    });
}

// ============================================
// CREATE TASK PAGE
// ============================================

function loadCreatePage() {
    updateBalanceUI();
    calculateMaxUsers();
    updateLinkPlaceholder();
}

function updateLinkPlaceholder() {
    var typeInputs = document.querySelectorAll('input[name="taskType"]');
    var type = '';
    for (var i = 0; i < typeInputs.length; i++) {
        if (typeInputs[i].checked) {
            type = typeInputs[i].value;
            break;
        }
    }
    
    var linkInput = document.getElementById('taskLink');
    var linkHint = document.getElementById('linkHint');
    
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
    
    if (linkInput.value) validateLink();
}

function validateLink() {
    var typeInputs = document.querySelectorAll('input[name="taskType"]');
    var type = '';
    for (var i = 0; i < typeInputs.length; i++) {
        if (typeInputs[i].checked) {
            type = typeInputs[i].value;
            break;
        }
    }
    
    var linkInput = document.getElementById('taskLink');
    var linkError = document.getElementById('linkError');
    var link = linkInput.value.trim();
    
    linkInput.classList.remove('error', 'valid');
    linkError.classList.remove('show');
    linkError.textContent = '';
    
    if (!link) return true;
    
    if (type === 'channel' || type === 'bot') {
        if (link.indexOf('https://t.me/') !== 0) {
            linkInput.classList.add('error');
            linkError.textContent = 'Link must start with https://t.me/';
            linkError.classList.add('show');
            return false;
        }
        
        var username = link.replace('https://t.me/', '');
        if (!username || username.length < 3) {
            linkInput.classList.add('error');
            linkError.textContent = type === 'channel' ? 'Enter valid channel username' : 'Enter valid bot username';
            linkError.classList.add('show');
            return false;
        }
        
        linkInput.classList.add('valid');
        return true;
    }
    
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
    var tonInput = document.getElementById('tonAmount');
    var ton = tonInput ? parseFloat(tonInput.value) || 0 : 0;
    var maxUsers = Math.floor(ton * 1000);
    
    setText('maxUsers', maxUsers || '', true);
    setText('taskCost', ton.toFixed(2) + ' TON');
    
    var after = userBalance.ton - ton;
    var afterEl = document.getElementById('afterBalance');
    if (afterEl) {
        afterEl.textContent = after.toFixed(2) + ' TON';
        afterEl.style.color = after < 0 ? '#ff5252' : '#00c853';
    }
    
    var btn = document.getElementById('createBtn');
    if (btn) btn.disabled = after < 0 || ton < 0.5;
}

function submitTask(e) {
    e.preventDefault();
    
    var typeInputs = document.querySelectorAll('input[name="taskType"]');
    var type = '';
    for (var i = 0; i < typeInputs.length; i++) {
        if (typeInputs[i].checked) {
            type = typeInputs[i].value;
            break;
        }
    }
    
    var titleInput = document.getElementById('taskTitle');
    var linkInput = document.getElementById('taskLink');
    var tonInput = document.getElementById('tonAmount');
    
    var title = titleInput ? titleInput.value.trim() : '';
    var link = linkInput ? linkInput.value.trim() : '';
    var ton = tonInput ? parseFloat(tonInput.value) || 0 : 0;
    var maxUsers = Math.floor(ton * 1000);
    
    if (!title) {
        showToast('Enter title', 'error');
        return;
    }
    var wordCount = title.split(/\s+/).filter(function(w) { return w; }).length;
    if (wordCount > 10) {
        showToast('Max 10 words in title', 'error');
        return;
    }
    
    if (!link) {
        showToast('Enter link', 'error');
        return;
    }
    if (!validateLink()) {
        showToast('Invalid link format', 'error');
        return;
    }
    
    if (ton < 0.5) {
        showToast('Min 0.5 TON', 'error');
        return;
    }
    if (ton > userBalance.ton) {
        showToast('Not enough TON', 'error');
        return;
    }
    
    var btn = document.getElementById('createBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    
    DB.updateBalance(currentUser.id, 'ton', ton, 'subtract').then(function() {
        return DB.createTask(type, {
            title: title,
            link: link,
            tonAmount: ton,
            maximum: maxUsers,
            createdBy: currentUser.id
        });
    }).then(function() {
        showToast('Task created!', 'success');
        vibrate();
        document.getElementById('createTaskForm').reset();
        showPage('earn');
    }).catch(function(e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Create Task';
    });
}

// ============================================
// PROMOTE PAGE
// ============================================

function loadPromotePage() {
    loadPromotionHistory();
}

function loadPromotionHistory() {
    var container = document.getElementById('promotionHistory');
    if (!container) return;
    
    DB.getUserPromotions(currentUser.id).then(function(promotions) {
        if (Object.keys(promotions).length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No submissions yet</p></div>';
            return;
        }
        
        var sorted = Object.entries(promotions).sort(function(a, b) {
            return b[1].createdAt - a[1].createdAt;
        });
        
        var html = '';
        sorted.forEach(function(entry) {
            var promo = entry[1];
            var statusClass = promo.status || 'pending';
            var statusText = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
            var platformIcons = {
                telegram: '📱',
                youtube: '📺',
                instagram: '📷'
            };
            var platformIcon = platformIcons[promo.platform] || '🔗';
            
            html += '<div class="submission-item">' +
                '<div class="submission-info">' +
                    '<h4>' + platformIcon + ' ' + promo.platform.charAt(0).toUpperCase() + promo.platform.slice(1) + ' - ' + promo.views + ' views</h4>' +
                    '<p>Reward: ' + promo.reward + ' TON</p>' +
                '</div>' +
                '<span class="submission-status ' + statusClass + '">' + statusText + '</span>' +
            '</div>';
        });
        
        container.innerHTML = html;
    }).catch(function() {
        container.innerHTML = '<div class="empty-state"><p>Error loading history</p></div>';
    });
}

function submitPromotion(e, platform) {
    e.preventDefault();
    
    var linkInput = document.getElementById(platform + 'Link');
    var viewsInput = document.getElementById(platform + 'Views');
    var link = linkInput ? linkInput.value.trim() : '';
    var views = viewsInput ? parseInt(viewsInput.value) || 0 : 0;
    
    if (!link || views < 200) {
        showToast('Please enter valid link and minimum 200 views', 'error');
        return;
    }
    
    var reward = 0;
    if (views >= 200 && views <= 500) {
        reward = 0.2;
    } else if (views > 500 && views <= 2000) {
        reward = 0.5;
    } else if (views > 2000 && views <= 10000) {
        reward = 1;
    } else if (views > 10000) {
        reward = 1.5;
    }
    
    var form = e.target;
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    
    DB.submitPromotion(currentUser.id, {
        platform: platform,
        link: link,
        views: views,
        reward: reward,
        status: 'pending'
    }).then(function() {
        showToast('Submitted for review! Reward: ' + reward + ' TON', 'success');
        vibrate();
        linkInput.value = '';
        viewsInput.value = '';
        loadPromotionHistory();
    }).catch(function() {
        showToast('Submission failed. Try again.', 'error');
    }).finally(function() {
        btn.disabled = false;
        btn.textContent = 'Submit for Review';
    });
}

function switchPromoTab(tab) {
    var tabs = document.querySelectorAll('.promo-tab');
    var contents = document.querySelectorAll('.promo-tab-content');
    
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    for (var j = 0; j < contents.length; j++) {
        contents[j].classList.remove('active');
    }
    
    var tabMap = {
        telegram: 'telegramPromo',
        youtube: 'youtubePromo',
        instagram: 'instagramPromo'
    };
    
    var tabIndex = ['telegram', 'youtube', 'instagram'].indexOf(tab);
    if (tabs[tabIndex]) tabs[tabIndex].classList.add('active');
    
    var content = document.getElementById(tabMap[tab]);
    if (content) content.classList.add('active');
}

// ============================================
// MODALS & UI
// ============================================

function showModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
    if (id === 'withdrawModal') {
        setText('modalGold', formatNum(userBalance.gold));
        setText('modalDiamond', formatNum(userBalance.diamond));
    }
}

function closeModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

function showToast(msg, type) {
    type = type || 'info';
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    vibrate();
    setTimeout(function() {
        toast.classList.remove('show');
    }, 3000);
}

function vibrate() {
    if (navigator.vibrate) navigator.vibrate(50);
    if (tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred) {
        tg.HapticFeedback.impactOccurred('medium');
    }
}

// ============================================
// UTILITIES
// ============================================

function setText(id, val, isInput) {
    var el = document.getElementById(id);
    if (el) {
        if (isInput) {
            el.value = val;
        } else {
            el.textContent = val;
        }
    }
}

function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
}

function escapeHtml(t) {
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            showToast('Copied!', 'success');
        }).catch(function() {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied!', 'success');
}

function copyText(id) {
    var el = document.getElementById(id);
    if (el) copyToClipboard(el.value);
}

function openLink(url) {
    if (tg && tg.openLink) {
        tg.openLink(url);
    } else if (tg && tg.openTelegramLink && url.indexOf('t.me') !== -1) {
        tg.openTelegramLink(url);
    } else {
        window.open(url, '_blank');
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================

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
window.switchPromoTab = switchPromoTab;
window.submitPromotion = submitPromotion;
