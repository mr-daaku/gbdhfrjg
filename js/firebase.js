// ============================================
// TonCloude - Firebase Configuration & Database
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyA6lXSMuCLGK3VSncYXTrlgJHE7ucbu1Oc",
    authDomain: "toncloudeid.firebaseapp.com",
    databaseURL: "https://toncloudeid-default-rtdb.firebaseio.com",
    projectId: "toncloudeid",
    storageBucket: "toncloudeid.firebasestorage.app",
    messagingSenderId: "226965058336",
    appId: "1:226965058336:web:29fe0c807dea6c995fdd45",
    measurementId: "G-9H4KJSGLHV"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================================
// USER FUNCTIONS
// ============================================

const DB = {
    // Get user reference
    userRef: (userId) => database.ref('users/' + userId),
    
    // Create new user
    async createUser(userId, data = {}) {
        await DB.userRef(userId).set({
            ton: 0,
            diamond: 0,
            gold: 100,
            createdAt: Date.now(),
            dailyTasks: { dailyCheck: 0, shareApp: 0, checkUpdate: 0 },
            referralProcessed: false,
            ...data
        });
    },
    
    // Get user data
    async getUser(userId) {
        const snap = await DB.userRef(userId).once('value');
        return snap.exists() ? snap.val() : null;
    },
    
    // Update user
    async updateUser(userId, data) {
        await DB.userRef(userId).update(data);
    },
    
    // Update balance
    async updateBalance(userId, type, amount, op = 'add') {
        const user = await DB.getUser(userId);
        if (!user) throw new Error('User not found');
        
        let newVal = op === 'add' ? (user[type] || 0) + amount : (user[type] || 0) - amount;
        if (newVal < 0) throw new Error('Insufficient balance');
        
        await DB.userRef(userId).update({ [type]: newVal });
        return newVal;
    },
    
    // Process referral (FIXED - only once)
    async processReferral(referrerId, newUserId) {
        if (referrerId === newUserId) return false;
        if (referrerId.startsWith('not_app_')) return false;
        
        const newUser = await DB.getUser(newUserId);
        if (!newUser) return false;
        
        // Check if already processed
        if (newUser.referredBy || newUser.referralProcessed) {
            console.log('Referral already processed for:', newUserId);
            return false;
        }
        
        const referrer = await DB.getUser(referrerId);
        if (!referrer) return false;
        
        // Mark as processed FIRST to prevent duplicates
        await DB.userRef(newUserId).update({ 
            referredBy: referrerId,
            referralProcessed: true 
        });
        
        // Add referral to referrer
        const refCount = Object.keys(referrer.refer || {}).length + 1;
        await DB.userRef(referrerId).child('refer/' + refCount).set(newUserId);
        
        // Give rewards: 1000 gold + 10 diamond
        await DB.userRef(referrerId).update({
            gold: (referrer.gold || 0) + 1000,
            diamond: (referrer.diamond || 0) + 10
        });
        
        console.log('Referral processed:', referrerId, 'got reward for:', newUserId);
        return true;
    },
    
    // Get referrals
    async getReferrals(userId) {
        const snap = await DB.userRef(userId).child('refer').once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    // Listen to user changes
    onUserChange(userId, callback) {
        DB.userRef(userId).on('value', snap => {
            if (snap.exists()) callback(snap.val());
        });
    },

    // ============================================
    // DAILY TASKS
    // ============================================
    
    async canClaimDaily(userId, taskType) {
        const user = await DB.getUser(userId);
        if (!user || !user.dailyTasks) return true;
        
        const lastClaim = user.dailyTasks[taskType] || 0;
        return Date.now() - lastClaim >= 86400000; // 24 hours
    },
    
    async claimDaily(userId, taskType) {
        const canClaim = await DB.canClaimDaily(userId, taskType);
        if (!canClaim) throw new Error('Already claimed today');
        
        const user = await DB.getUser(userId);
        const rewards = {
            dailyCheck: { gold: 1000, diamond: 10 },
            shareApp: { gold: 500, diamond: 5 },
            checkUpdate: { gold: 300, diamond: 3 }
        }[taskType];
        
        await DB.userRef(userId).update({
            gold: (user.gold || 0) + rewards.gold,
            diamond: (user.diamond || 0) + rewards.diamond,
            [`dailyTasks/${taskType}`]: Date.now()
        });
        
        return rewards;
    },

    // ============================================
    // TASKS
    // ============================================
    
    async createTask(type, data) {
        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await database.ref(`tasks/${type}/${taskId}`).set({
            ...data,
            createdAt: Date.now(),
            completedCount: 0
        });
        return taskId;
    },
    
    async getTasks(type) {
        const snap = await database.ref('tasks/' + type).once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    async completeTask(type, taskId, userId) {
        const userRef = DB.userRef(userId);
        const taskRef = database.ref(`tasks/${type}/${taskId}`);
        
        // Check if already completed
        const completedSnap = await userRef.child('completedTasks/' + taskId).once('value');
        if (completedSnap.exists()) throw new Error('Already completed');
        
        const taskSnap = await taskRef.once('value');
        if (!taskSnap.exists()) throw new Error('Task not found');
        
        const task = taskSnap.val();
        if (task.completedCount >= task.maximum) throw new Error('Task limit reached');
        
        const newCount = (task.completedCount || 0) + 1;
        
        // Update task count
        await taskRef.update({ completedCount: newCount });
        
        // Mark completed for user
        await userRef.child('completedTasks/' + taskId).set({ at: Date.now(), type });
        
        // Delete if max reached
        if (newCount >= task.maximum) await taskRef.remove();
        
        return true;
    },
    
    async isTaskCompleted(taskId, userId) {
        const snap = await DB.userRef(userId).child('completedTasks/' + taskId).once('value');
        return snap.exists();
    },

    // ============================================
    // PROMO CODES
    // ============================================
    
    async createPromo(code, rewards, limit = 100) {
        await database.ref('promoCodes/' + code.toUpperCase()).set({
            ...rewards,
            limit,
            usedCount: 0,
            createdAt: Date.now()
        });
    },
    
    async claimPromo(code, userId) {
        const promoRef = database.ref('promoCodes/' + code.toUpperCase());
        const snap = await promoRef.once('value');
        
        if (!snap.exists()) throw new Error('Invalid code');
        
        const promo = snap.val();
        
        // Check if used
        const usedSnap = await promoRef.child('usedBy/' + userId).once('value');
        if (usedSnap.exists()) throw new Error('Already claimed');
        
        // Check limit
        if ((promo.usedCount || 0) >= promo.limit) throw new Error('Code expired');
        
        // Mark used
        await promoRef.update({ usedCount: (promo.usedCount || 0) + 1 });
        await promoRef.child('usedBy/' + userId).set(Date.now());
        
        // Give rewards
        const user = await DB.getUser(userId);
        const updates = {};
        if (promo.gold) updates.gold = (user.gold || 0) + promo.gold;
        if (promo.diamond) updates.diamond = (user.diamond || 0) + promo.diamond;
        if (promo.ton) updates.ton = (user.ton || 0) + promo.ton;
        
        await DB.userRef(userId).update(updates);
        return promo;
    },
    
    async getAllPromos() {
        const snap = await database.ref('promoCodes').once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    async deletePromo(code) {
        await database.ref('promoCodes/' + code).remove();
    },

    // ============================================
    // WITHDRAWALS
    // ============================================
    
    async createWithdraw(userId, goldAmount, address) {
        if (goldAmount < 100000) throw new Error('Min 100,000 Gold');
        
        const diamondFee = Math.floor(goldAmount / 100000) * 20000;
        const user = await DB.getUser(userId);
        
        if (!user) throw new Error('User not found');
        if (user.gold < goldAmount) throw new Error('Not enough Gold');
        if (user.diamond < diamondFee) throw new Error(`Need ${diamondFee} Diamond`);
        
        // Deduct
        await DB.userRef(userId).update({
            gold: user.gold - goldAmount,
            diamond: user.diamond - diamondFee
        });
        
        const wdId = 'wd_' + Date.now();
        const wdData = {
            userId,
            goldAmount,
            diamondFee,
            address,
            status: 'pending',
            createdAt: Date.now()
        };
        
        await database.ref('withdrawRequests/' + wdId).set(wdData);
        await DB.userRef(userId).child('withdrawals/' + wdId).set(wdData);
        
        return wdId;
    },
    
    async getAllWithdraws() {
        const snap = await database.ref('withdrawRequests').once('value');
        return snap.exists() ? snap.val() : {};
    },
    
    async updateWithdrawStatus(wdId, status) {
        const wdRef = database.ref('withdrawRequests/' + wdId);
        const snap = await wdRef.once('value');
        
        if (!snap.exists()) return false;
        
        const wd = snap.val();
        await wdRef.update({ status, processedAt: Date.now() });
        await DB.userRef(wd.userId).child('withdrawals/' + wdId).update({ status, processedAt: Date.now() });
        
        // Refund if rejected
        if (status === 'rejected') {
            const user = await DB.getUser(wd.userId);
            await DB.userRef(wd.userId).update({
                gold: (user.gold || 0) + wd.goldAmount,
                diamond: (user.diamond || 0) + wd.diamondFee
            });
        }
        
        return true;
    },

    // ============================================
    // NFTs
    // ============================================
    
    async buyNFT(userId, nftId, price) {
        const user = await DB.getUser(userId);
        if (!user) throw new Error('User not found');
        if (user.diamond < price) throw new Error('Not enough Diamond');
        
        // Check if owned
        const ownedSnap = await DB.userRef(userId).child('nfts/' + nftId).once('value');
        if (ownedSnap.exists()) throw new Error('Already owned');
        
        await DB.userRef(userId).update({
            diamond: user.diamond - price,
            [`nfts/${nftId}`]: { at: Date.now(), price }
        });
        
        return true;
    },
    
    async getUserNFTs(userId) {
        const snap = await DB.userRef(userId).child('nfts').once('value');
        return snap.exists() ? snap.val() : {};
    },

    // ============================================
    // ADMIN
    // ============================================
    
    async getAllUsers() {
        const snap = await database.ref('users').once('value');
        return snap.exists() ? snap.val() : {};
    }
};

window.DB = DB;
window.database = database;