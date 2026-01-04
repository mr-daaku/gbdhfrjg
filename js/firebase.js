// ============================================
// TonCloude - Firebase Configuration & Database
// WITH AUTO DEPOSIT SYSTEM (5 min limit)
// ============================================

var firebaseConfig = {
    apiKey: "AIzaSyA6lXSMuCLGK3VSncYXTrlgJHE7ucbu1Oc",
    authDomain: "toncloudeid.firebaseapp.com",
    databaseURL: "https://toncloudeid-default-rtdb.firebaseio.com",
    projectId: "toncloudeid",
    storageBucket: "toncloudeid.firebasestorage.app",
    messagingSenderId: "226965058336",
    appId: "1:226965058336:web:29fe0c807dea6c995fdd45"
};

firebase.initializeApp(firebaseConfig);
var database = firebase.database();

// ============================================
// DEPOSIT WALLET CONFIG
// ============================================
var DEPOSIT_CONFIG = {
    walletAddress: "UQDqx6Ds4sZdlQI9ooU22YM0eBSqxIx03rPF2ylB35a3xdWc",
    scanInterval: 5000,
    minDeposit: 0.01,
    maxAgeMinutes: 5, // Only process transactions within last 5 minutes
    apiUrl: "https://toncenter.com/api/v2/getTransactions"
};

// ============================================
// DATABASE FUNCTIONS
// ============================================

var DB = {
    userRef: function(userId) {
        return database.ref('users/' + userId);
    },
    
    createUser: async function(userId, data) {
        data = data || {};
        await DB.userRef(userId).set({
            ton: 0,
            diamond: 0,
            gold: 100,
            createdAt: Date.now(),
            dailyTasks: { dailyCheck: 0, shareApp: 0, checkUpdate: 0 },
            referralProcessed: false,
            username: data.username || '',
            firstName: data.firstName || ''
        });
    },
    
    getUser: async function(userId) {
        var snap = await DB.userRef(userId).once('value');
        return snap.exists() ? snap.val() : null;
    },
    
    updateUser: async function(userId, data) {
        await DB.userRef(userId).update(data);
    },
    
    updateBalance: async function(userId, type, amount, op) {
        op = op || 'add';
        var user = await DB.getUser(userId);
        if (!user) throw new Error('User not found');
        
        var current = user[type] || 0;
        var newVal = op === 'add' ? current + amount : current - amount;
        if (newVal < 0) throw new Error('Insufficient balance');
        
        var updateData = {};
        updateData[type] = newVal;
        await DB.userRef(userId).update(updateData);
        return newVal;
    },
    
    processReferral: async function(referrerId, newUserId) {
        if (referrerId === newUserId) return false;
        if (referrerId.indexOf('not_app_') === 0) return false;
        
        var newUser = await DB.getUser(newUserId);
        if (!newUser) return false;
        
        if (newUser.referredBy || newUser.referralProcessed) {
            console.log('Referral already processed for:', newUserId);
            return false;
        }
        
        var referrer = await DB.getUser(referrerId);
        if (!referrer) return false;
        
        await DB.userRef(newUserId).update({ 
            referredBy: referrerId,
            referralProcessed: true 
        });
        
        var referrals = referrer.refer || {};
        var refCount = Object.keys(referrals).length + 1;
        await DB.userRef(referrerId).child('refer/' + refCount).set(newUserId);
        
        await DB.userRef(referrerId).update({
            gold: (referrer.gold || 0) + 10000,
            diamond: (referrer.diamond || 0) + 20
        });
        
        console.log('Referral processed:', referrerId, 'got reward for:', newUserId);
        return true;
    },
    
    getReferrals: async function(userId) {
        var snap = await DB.userRef(userId).child('refer').once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    onUserChange: function(userId, callback) {
        DB.userRef(userId).on('value', function(snap) {
            if (snap.exists()) callback(snap.val());
        });
    },

    // ============================================
    // DAILY TASKS
    // ============================================
    
    canClaimDaily: async function(userId, taskType) {
        var user = await DB.getUser(userId);
        if (!user || !user.dailyTasks) return true;
        
        var lastClaim = user.dailyTasks[taskType] || 0;
        return Date.now() - lastClaim >= 86400000;
    },
    
    claimDaily: async function(userId, taskType) {
        var canClaim = await DB.canClaimDaily(userId, taskType);
        if (!canClaim) throw new Error('Already claimed today');
        
        var user = await DB.getUser(userId);
        var rewardsMap = {
            dailyCheck: { gold: 1000, diamond: 10 },
            shareApp: { gold: 500, diamond: 5 },
            checkUpdate: { gold: 300, diamond: 3 }
        };
        var rewards = rewardsMap[taskType];
        
        var updateData = {
            gold: (user.gold || 0) + rewards.gold,
            diamond: (user.diamond || 0) + rewards.diamond
        };
        updateData['dailyTasks/' + taskType] = Date.now();
        
        await DB.userRef(userId).update(updateData);
        return rewards;
    },

    // ============================================
    // TASKS
    // ============================================
    
    createTask: async function(type, data) {
        var taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        var taskData = {
            title: data.title,
            link: data.link,
            tonAmount: data.tonAmount,
            maximum: data.maximum,
            createdBy: data.createdBy,
            createdAt: Date.now(),
            completedCount: 0
        };
        await database.ref('tasks/' + type + '/' + taskId).set(taskData);
        return taskId;
    },
    
    getTasks: async function(type) {
        var snap = await database.ref('tasks/' + type).once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    completeTask: async function(type, taskId, userId) {
        var userRef = DB.userRef(userId);
        var taskRef = database.ref('tasks/' + type + '/' + taskId);
        
        var completedSnap = await userRef.child('completedTasks/' + taskId).once('value');
        if (completedSnap.exists()) throw new Error('Already completed');
        
        var taskSnap = await taskRef.once('value');
        if (!taskSnap.exists()) throw new Error('Task not found');
        
        var task = taskSnap.val();
        if (task.completedCount >= task.maximum) throw new Error('Task limit reached');
        
        var newCount = (task.completedCount || 0) + 1;
        
        await taskRef.update({ completedCount: newCount });
        await userRef.child('completedTasks/' + taskId).set({ at: Date.now(), type: type });
        
        if (newCount >= task.maximum) await taskRef.remove();
        
        return true;
    },
    
    isTaskCompleted: async function(taskId, userId) {
        var snap = await DB.userRef(userId).child('completedTasks/' + taskId).once('value');
        return snap.exists();
    },

    // ============================================
    // PROMO CODES
    // ============================================
    
    createPromo: async function(code, rewards, limit) {
        limit = limit || 100;
        var promoData = {
            gold: rewards.gold || 0,
            diamond: rewards.diamond || 0,
            ton: rewards.ton || 0,
            limit: limit,
            usedCount: 0,
            createdAt: Date.now()
        };
        await database.ref('promoCodes/' + code.toUpperCase()).set(promoData);
    },
    
    claimPromo: async function(code, userId) {
        var promoRef = database.ref('promoCodes/' + code.toUpperCase());
        var snap = await promoRef.once('value');
        
        if (!snap.exists()) throw new Error('Invalid code');
        
        var promo = snap.val();
        
        var usedSnap = await promoRef.child('usedBy/' + userId).once('value');
        if (usedSnap.exists()) throw new Error('Already claimed');
        
        if ((promo.usedCount || 0) >= promo.limit) throw new Error('Code expired');
        
        await promoRef.update({ usedCount: (promo.usedCount || 0) + 1 });
        await promoRef.child('usedBy/' + userId).set(Date.now());
        
        var user = await DB.getUser(userId);
        var updates = {};
        if (promo.gold) updates.gold = (user.gold || 0) + promo.gold;
        if (promo.diamond) updates.diamond = (user.diamond || 0) + promo.diamond;
        if (promo.ton) updates.ton = (user.ton || 0) + promo.ton;
        
        await DB.userRef(userId).update(updates);
        return promo;
    },
    
    getAllPromos: async function() {
        var snap = await database.ref('promoCodes').once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    deletePromo: async function(code) {
        await database.ref('promoCodes/' + code).remove();
    },

    // ============================================
    // WITHDRAWALS
    // ============================================
    
    createWithdraw: async function(userId, goldAmount, address) {
        if (goldAmount < 500000) throw new Error('Min 500,000 Gold');
        
        var diamondFee = Math.floor(goldAmount / 500000) * 750;
        var user = await DB.getUser(userId);
        
        if (!user) throw new Error('User not found');
        if (user.gold < goldAmount) throw new Error('Not enough Gold');
        if (user.diamond < diamondFee) throw new Error('Need ' + diamondFee + ' Diamond');
        
        await DB.userRef(userId).update({
            gold: user.gold - goldAmount,
            diamond: user.diamond - diamondFee
        });
        
        var wdId = 'wd_' + Date.now();
        var wdData = {
            userId: userId,
            goldAmount: goldAmount,
            diamondFee: diamondFee,
            address: address,
            status: 'pending',
            createdAt: Date.now()
        };
        
        await database.ref('withdrawRequests/' + wdId).set(wdData);
        await DB.userRef(userId).child('withdrawals/' + wdId).set(wdData);
        
        return wdId;
    },
    
    getAllWithdraws: async function() {
        var snap = await database.ref('withdrawRequests').once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    updateWithdrawStatus: async function(wdId, status) {
        var wdRef = database.ref('withdrawRequests/' + wdId);
        var snap = await wdRef.once('value');
        
        if (!snap.exists()) return false;
        
        var wd = snap.val();
        await wdRef.update({ status: status, processedAt: Date.now() });
        await DB.userRef(wd.userId).child('withdrawals/' + wdId).update({ status: status, processedAt: Date.now() });
        
        return true;
    },

    // ============================================
    // DEPOSITS - NEW STRUCTURE
    // Structure: processedDeposits/{userId}/{timestamp}: amount
    // ============================================
    
    // Check if deposit already processed for this user at this time
    isDepositProcessed: async function(userId, txTime) {
        var snap = await database.ref('processedDeposits/' + userId + '/' + txTime).once('value');
        return snap.exists();
    },
    
    // Save deposit in new structure
    saveDeposit: async function(userId, txTime, amount) {
        await database.ref('processedDeposits/' + userId + '/' + txTime).set(amount);
    },
    
    // Process deposit - add TON to user
    processDeposit: async function(userId, amount, txTime) {
        // Check if already processed
        var alreadyProcessed = await DB.isDepositProcessed(userId, txTime);
        if (alreadyProcessed) {
            console.log('Deposit already processed:', userId, txTime);
            return { success: false, reason: 'already_processed' };
        }
        
        // Check if user exists
        var user = await DB.getUser(userId);
        if (!user) {
            console.log('User not found for deposit:', userId);
            return { success: false, reason: 'user_not_found' };
        }
        
        // Add TON to user balance
        var newBalance = (user.ton || 0) + amount;
        await DB.userRef(userId).update({ ton: newBalance });
        
        // Save deposit record
        await DB.saveDeposit(userId, txTime, amount);
        
        // Also save in user's deposits for history
        var depositId = 'dep_' + txTime;
        await DB.userRef(userId).child('deposits/' + depositId).set({
            amount: amount,
            txTime: txTime,
            status: 'completed',
            createdAt: Date.now()
        });
        
        console.log('✅ Deposit processed: ' + amount + ' TON to user ' + userId);
        return { success: true, newBalance: newBalance, amount: amount };
    },
    
    // Get user deposits
    getUserDeposits: async function(userId) {
        var snap = await DB.userRef(userId).child('deposits').once('value');
        return snap.exists() ? snap.val() : {};
    },

    // ============================================
    // NFTs
    // ============================================
    
    buyNFT: async function(userId, nftId, price) {
        var user = await DB.getUser(userId);
        if (!user) throw new Error('User not found');
        if (user.diamond < price) throw new Error('Not enough Diamond');
        
        var ownedSnap = await DB.userRef(userId).child('nfts/' + nftId).once('value');
        if (ownedSnap.exists()) throw new Error('Already owned');
        
        var updateData = {
            diamond: user.diamond - price
        };
        updateData['nfts/' + nftId] = { at: Date.now(), price: price };
        
        await DB.userRef(userId).update(updateData);
        return true;
    },
    
    getUserNFTs: async function(userId) {
        var snap = await DB.userRef(userId).child('nfts').once('value');
        return snap.exists() ? snap.val() : {};
    },

    // ============================================
    // PROMOTIONS
    // ============================================
    
    submitPromotion: async function(userId, data) {
        var promoId = 'promo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        var promoData = {
            platform: data.platform,
            link: data.link,
            views: data.views,
            reward: data.reward,
            userId: userId,
            createdAt: Date.now(),
            status: 'pending'
        };
        
        await database.ref('promotions/' + promoId).set(promoData);
        await DB.userRef(userId).child('promotions/' + promoId).set(promoData);
        
        return promoId;
    },
    
    getUserPromotions: async function(userId) {
        var snap = await DB.userRef(userId).child('promotions').once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    getAllPromotions: async function() {
        var snap = await database.ref('promotions').once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    updatePromotionStatus: async function(promoId, status, reward) {
        reward = reward || 0;
        var promoRef = database.ref('promotions/' + promoId);
        var snap = await promoRef.once('value');
        
        if (!snap.exists()) return false;
        
        var promo = snap.val();
        await promoRef.update({ status: status, processedAt: Date.now(), finalReward: reward });
        await DB.userRef(promo.userId).child('promotions/' + promoId).update({ 
            status: status, 
            processedAt: Date.now(),
            finalReward: reward 
        });
        
        if (status === 'approved' && reward > 0) {
            var user = await DB.getUser(promo.userId);
            await DB.userRef(promo.userId).update({
                ton: (user.ton || 0) + reward
            });
        }
        
        return true;
    },

    // ============================================
    // ADMIN
    // ============================================
    
    getAllUsers: async function() {
        var snap = await database.ref('users').once('value');
        return snap.exists() ? snap.val() : {};
    }
};

// ============================================
// DEPOSIT SCANNER CLASS - WITH 5 MIN LIMIT
// ============================================

var DepositScanner = {
    isRunning: false,
    intervalId: null,
    scanCount: 0,
    
    // Extract memo from transaction
    extractMemo: function(tx) {
        try {
            if (tx && tx.in_msg && tx.in_msg.message) {
                return tx.in_msg.message.trim();
            }
            if (tx && tx.in_msg && tx.in_msg.msg_data && tx.in_msg.msg_data.text) {
                return tx.in_msg.msg_data.text.trim();
            }
        } catch (e) {
            console.log("Error extracting memo:", e);
        }
        return '';
    },
    
    // Check if transaction is within 5 minutes
    isWithinTimeLimit: function(txTimestamp) {
        var now = Date.now();
        var txTime = txTimestamp * 1000; // Convert to milliseconds
        var maxAge = DEPOSIT_CONFIG.maxAgeMinutes * 60 * 1000; // 5 minutes in ms
        
        return (now - txTime) <= maxAge;
    },
    
    // Fetch transactions from TON Center API
    fetchTransactions: async function() {
        try {
            var url = DEPOSIT_CONFIG.apiUrl + '?address=' + encodeURIComponent(DEPOSIT_CONFIG.walletAddress) + '&limit=20';
            var response = await fetch(url);
            var data = await response.json();
            
            if (!data.ok) {
                console.error('API Error:', data.error);
                return [];
            }
            
            return data.result || [];
        } catch (e) {
            console.error('Fetch error:', e);
            return [];
        }
    },
    
    // Process incoming transactions
    processTransactions: async function(transactions) {
        var processedCount = 0;
        
        for (var i = 0; i < transactions.length; i++) {
            var tx = transactions[i];
            
            // Only process incoming transactions (received)
            var hasIncoming = tx.in_msg && tx.in_msg.value && parseInt(tx.in_msg.value) > 0;
            if (!hasIncoming) continue;
            
            // Get transaction time (utime)
            var txTime = tx.utime;
            if (!txTime) continue;
            
            // ✅ Check if transaction is within 5 minutes
            if (!DepositScanner.isWithinTimeLimit(txTime)) {
                console.log('Skipping old transaction (>5 min):', new Date(txTime * 1000).toLocaleString());
                continue;
            }
            
            // Get amount in TON
            var amount = parseInt(tx.in_msg.value) / 1e9;
            
            // Check minimum deposit
            if (amount < DEPOSIT_CONFIG.minDeposit) {
                console.log('Skipping small deposit:', amount, 'TON');
                continue;
            }
            
            // Get memo (user ID)
            var memo = DepositScanner.extractMemo(tx);
            
            if (!memo) {
                console.log('No memo found for tx at:', new Date(txTime * 1000).toLocaleString());
                continue;
            }
            
            // Process the deposit with new structure
            var result = await DB.processDeposit(memo, amount, txTime);
            
            if (result.success) {
                processedCount++;
                console.log('💰 Deposit: ' + amount + ' TON -> User: ' + memo + ' | Time: ' + new Date(txTime * 1000).toLocaleString());
            }
        }
        
        return processedCount;
    },
    
    // Single scan
    scan: async function() {
        DepositScanner.scanCount++;
        console.log('🔍 Scan #' + DepositScanner.scanCount + ' at ' + new Date().toLocaleTimeString());
        
        var transactions = await DepositScanner.fetchTransactions();
        
        if (transactions.length > 0) {
            var processed = await DepositScanner.processTransactions(transactions);
            if (processed > 0) {
                console.log('✅ Processed ' + processed + ' deposits');
            }
        }
    },
    
    // Start scanning
    start: function() {
        if (DepositScanner.isRunning) {
            console.log('Scanner already running');
            return;
        }
        
        DepositScanner.isRunning = true;
        console.log('🚀 Deposit scanner started (5 min limit active)');
        
        // Initial scan
        DepositScanner.scan();
        
        // Set interval
        DepositScanner.intervalId = setInterval(function() {
            DepositScanner.scan();
        }, DEPOSIT_CONFIG.scanInterval);
    },
    
    // Stop scanning
    stop: function() {
        if (!DepositScanner.isRunning) {
            console.log('Scanner not running');
            return;
        }
        
        DepositScanner.isRunning = false;
        if (DepositScanner.intervalId) {
            clearInterval(DepositScanner.intervalId);
            DepositScanner.intervalId = null;
        }
        console.log('🛑 Deposit scanner stopped');
    },
    
    // Get status
    getStatus: function() {
        return {
            isRunning: DepositScanner.isRunning,
            scanCount: DepositScanner.scanCount,
            walletAddress: DEPOSIT_CONFIG.walletAddress,
            scanInterval: DEPOSIT_CONFIG.scanInterval,
            maxAgeMinutes: DEPOSIT_CONFIG.maxAgeMinutes
        };
    }
};

// Auto-start scanner after 2 seconds
setTimeout(function() {
    DepositScanner.start();
}, 2000);

window.DB = DB;
window.database = database;
window.DepositScanner = DepositScanner;
window.DEPOSIT_CONFIG = DEPOSIT_CONFIG;