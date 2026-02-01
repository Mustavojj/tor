const APP_CONFIG = {
    APP_NAME: "Tornado TON",
    BOT_USERNAME: "Tornado_Rbot",
    BOT_TOKEN: "YOUR_BOT_TOKEN_HERE",
    MINIMUM_WITHDRAW: 0.10,
    REFERRAL_BONUS_TON: 0.001,
    REFERRAL_PERCENTAGE: 20,
    WELCOME_TASKS: [
        {
            name: "Join Official Channel",
            url: "https://t.me/Tornado_Channel",
            channel: "@Tornado_Channel"
        },
        {
            name: "Join Partner 1",
            url: "https://t.me/MONEYHUB9_69",
            channel: "@MONEYHUB9_69"
        },
        {
            name: "Join Partner 2",
            url: "https://t.me/Crypto_al2",
            channel: "@Crypto_al2"
        }
    ],
    WELCOME_MESSAGE: {
        text: "⚡ Welcome to Tornado!",
        photo: "https://i.ibb.co/GvWFRrnp/ninja.png",
        buttons: [
            {
                text: "Start App 💎",
                url: "https://t.me/Tornado_Rbot/start"
            },
            {
                text: "Get News 📰",
                url: "https://t.me/Tornado_Channel"
            }
        ]
    },
    TASK_PRICES: {
        100: 0.100,
        250: 0.250,
        500: 0.500,
        1000: 1.000,
        2500: 2.500,
        5000: 5.000
    }
};

import { CacheManager, NotificationManager, SecurityManager, AdManager } from './modules/core.js';
import { TaskManager, ReferralManager } from './modules/features.js';

class TornadoApp {
    
    constructor() {
        this.darkMode = true;
        this.tg = null;
        this.db = null;
        this.auth = null;
        this.firebaseInitialized = false;
        
        this.currentUser = null;
        this.userState = {};
        this.appConfig = APP_CONFIG;
        
        this.userCompletedTasks = new Set();
        this.partnerTasks = [];
        this.isInitialized = false;
        this.isInitializing = false;
        this.userWithdrawals = [];
        this.appStats = {
            totalUsers: 0,
            onlineUsers: 0,
            totalPayments: 0,
            totalWithdrawals: 0
        };
        
        this.pages = [
            { id: 'tasks-page', name: 'Earn', icon: 'fa-coins', color: '#3b82f6' },
            { id: 'referrals-page', name: 'Invite', icon: 'fa-user-plus', color: '#3b82f6' },
            { id: 'profile-page', name: 'Profile', icon: 'fa-user', color: '#3b82f6' }
        ];
        
        this.cache = new CacheManager();
        this.notificationManager = null;
        this.securityManager = new SecurityManager();
        this.adManager = null;
        this.isProcessingTask = false;
        
        this.tgUser = null;
        
        this.taskManager = null;
        this.referralManager = null;
        
        this.currentTasksTab = 'main';
        this.isProcessingAd = false;
        this.isCopying = false;
        this.pendingReferral = null;
        
        this.referralBonusGiven = new Set();
        
        this.adTimers = {
            ad1: 0
        };
        
        this.adCooldown = 600000;
        
        this.referralMonitorInterval = null;
        
        this.welcomeTasksShown = false;
        this.welcomeTasksCompleted = false;
        
        this.remoteConfig = null;
        this.configCache = null;
        this.configTimestamp = 0;
        
        this.pendingReferralAfterWelcome = null;
        this.rateLimiter = new (this.getRateLimiterClass())();
        
        this.inAppAdsInitialized = false;
        this.inAppAdsTimer = null;
        
        this.serverTimeOffset = 0;
        this.timeSyncInterval = null;
        
        this.welcomeMessageSent = new Set();
    }

    getRateLimiterClass() {
        return class RateLimiter {
            constructor() {
                this.requests = new Map();
                this.limits = {
                    'task_start': { limit: 1, window: 3000 },
                    'withdrawal': { limit: 1, window: 86400000 },
                    'ad_reward': { limit: 10, window: 300000 },
                    'promo_code': { limit: 5, window: 300000 }
                };
            }

            checkLimit(userId, action) {
                const key = `${userId}_${action}`;
                const now = this.getServerTime();
                const limitConfig = this.limits[action] || { limit: 5, window: 60000 };
                
                if (!this.requests.has(key)) this.requests.set(key, []);
                
                const userRequests = this.requests.get(key);
                const windowStart = now - limitConfig.window;
                const recentRequests = userRequests.filter(time => time > windowStart);
                this.requests.set(key, recentRequests);
                
                if (recentRequests.length >= limitConfig.limit) {
                    return {
                        allowed: false,
                        remaining: Math.ceil((recentRequests[0] + limitConfig.window - now) / 1000)
                    };
                }
                
                recentRequests.push(now);
                return { allowed: true };
            }

            getServerTime() {
                return Date.now() + (window.app?.serverTimeOffset || 0);
            }
        };
    }

    getServerTime() {
        return Date.now() + this.serverTimeOffset;
    }

    async syncServerTime() {
        try {
            const startTime = Date.now();
            const serverTime = await this.getFirebaseServerTime();
            const endTime = Date.now();
            const rtt = endTime - startTime;
            this.serverTimeOffset = serverTime - endTime + (rtt / 2);
            
            return true;
        } catch (error) {
            this.serverTimeOffset = 0;
            return false;
        }
    }

    async getFirebaseServerTime() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const ref = this.db.ref('.info/serverTimeOffset');
            ref.once('value')
                .then(snapshot => {
                    const offset = snapshot.val() || 0;
                    resolve(Date.now() + offset);
                })
                .catch(reject);
        });
    }

    async initialize() {
        if (this.isInitializing || this.isInitialized) return;
        
        this.isInitializing = true;
        
        try {
            this.showLoadingProgress(5);
            
            if (!window.Telegram || !window.Telegram.WebApp) {
                this.showError("Please open from Telegram Mini App");
                return;
            }
            
            this.tg = window.Telegram.WebApp;
            
            if (!this.tg.initDataUnsafe || !this.tg.initDataUnsafe.user) {
                this.showError("User data not available");
                return;
            }
            
            this.tgUser = this.tg.initDataUnsafe.user;
            
            this.showLoadingProgress(8);
            const multiAccountAllowed = await this.checkMultiAccount(this.tgUser.id);
            if (!multiAccountAllowed) {
                this.isInitializing = false;
                return;
            }
            
            this.showLoadingProgress(12);
            
            this.tg.ready();
            this.tg.expand();
            
            this.showLoadingProgress(15);
            this.setupTelegramTheme();
            
            this.notificationManager = new NotificationManager();
            
            this.showLoadingProgress(20);
            
            const firebaseSuccess = await this.initializeFirebase();
            
            if (firebaseSuccess) {
                this.setupFirebaseAuth();
            }
            
            this.showLoadingProgress(40);
            
            await this.syncServerTime();
            
            if (this.timeSyncInterval) {
                clearInterval(this.timeSyncInterval);
            }
            this.timeSyncInterval = setInterval(() => this.syncServerTime(), 300000);
            
            await this.loadUserData();
            
            if (this.userState.status === 'ban') {
                this.showBannedPage();
                return;
            }
            
            this.showLoadingProgress(50);
            
            this.adManager = new AdManager(this);
            this.taskManager = new TaskManager(this);
            this.referralManager = new ReferralManager(this);
            
            this.startReferralMonitor();
            
            this.showLoadingProgress(60);
            
            try {
                await this.loadTasksData();
            } catch (taskError) {
                console.error("Error loading tasks:", taskError);
            }
            
            this.showLoadingProgress(70);
            
            try {
                await this.loadHistoryData();
            } catch (historyError) {
                console.error("Error loading history:", historyError);
            }
            
            this.showLoadingProgress(80);
            
            try {
                await this.loadAppStats();
            } catch (statsError) {
                console.error("Error loading stats:", statsError);
            }
            
            this.showLoadingProgress(85);
            
            try {
                await this.loadAdTimers();
            } catch (adError) {
                console.error("Error loading ad timers:", adError);
            }
            
            this.showLoadingProgress(90);
            this.renderUI();
            
            this.darkMode = true;
            document.body.classList.add('dark-mode');
            
            this.isInitialized = true;
            this.isInitializing = false;
            
            this.showLoadingProgress(100);
            
            setTimeout(() => {
                const appLoader = document.getElementById('app-loader');
                const app = document.getElementById('app');
                
                if (appLoader) {
                    appLoader.style.opacity = '0';
                    appLoader.style.transition = 'opacity 0.5s ease';
                    
                    setTimeout(() => {
                        appLoader.style.display = 'none';
                    }, 500);
                }
                
                if (app) {
                    app.style.display = 'block';
                    setTimeout(() => {
                        app.style.opacity = '1';
                        app.style.transition = 'opacity 0.3s ease';
                    }, 50);
                }
                
                if (this.adManager) {
                    this.adManager.startAdTimers();
                }
                
                this.initializeInAppAds();
                
                this.showWelcomeTasksModal();
                
                this.sendWelcomeMessage();
                
            }, 500);
            
        } catch (error) {
            console.error("Initialization error:", error);
            if (this.notificationManager) {
                this.notificationManager.showNotification(
                    "Initialization Error",
                    "App loaded with limited functionality. Please refresh.",
                    "warning"
                );
            }
            
            try {
                this.userState = this.getDefaultUserState();
                this.renderUI();
                
                const appLoader = document.getElementById('app-loader');
                const app = document.getElementById('app');
                
                if (appLoader) appLoader.style.display = 'none';
                if (app) app.style.display = 'block';
                
            } catch (renderError) {
                this.showError("Failed to initialize app: " + error.message);
            }
            
            this.isInitializing = false;
        }
    }

    async sendWelcomeMessage() {
        try {
            if (!this.tgUser || this.welcomeMessageSent.has(this.tgUser.id)) {
                return;
            }
            
            const isNewUser = await this.isNewUser(this.tgUser.id);
            if (!isNewUser) {
                return;
            }
            
            const botToken = this.appConfig.BOT_TOKEN;
            if (!botToken || botToken === "YOUR_BOT_TOKEN_HERE") {
                console.log("Bot token not configured");
                return;
            }
            
            const welcomeConfig = this.appConfig.WELCOME_MESSAGE;
            
            const response = await fetch('/api/send-welcome', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-telegram-user': this.tgUser.id.toString(),
                    'x-telegram-auth': this.tg?.initData || ''
                },
                body: JSON.stringify({
                    chat_id: this.tgUser.id,
                    text: welcomeConfig.text,
                    photo: welcomeConfig.photo,
                    buttons: welcomeConfig.buttons
                })
            });
            
            if (response.ok) {
                this.welcomeMessageSent.add(this.tgUser.id);
                console.log("Welcome message sent to user:", this.tgUser.id);
            }
            
        } catch (error) {
            console.error("Error sending welcome message:", error);
        }
    }

    async isNewUser(userId) {
        try {
            if (!this.db) return true;
            
            const userRef = this.db.ref(`users/${userId}`);
            const snapshot = await userRef.once('value');
            
            if (!snapshot.exists()) {
                return true;
            }
            
            const userData = snapshot.val();
            return userData.welcomeMessageSent !== true;
            
        } catch (error) {
            console.error("Error checking if user is new:", error);
            return true;
        }
    }

    initializeInAppAds() {
        if (this.inAppAdsInitialized) return;
        
        try {
            if (typeof window.AdBlock2 !== 'undefined') {
                this.inAppAdsInitialized = true;
                
                setTimeout(() => {
                    this.showInAppAd();
                    this.inAppAdsTimer = setInterval(() => {
                        this.showInAppAd();
                    }, 150000);
                }, 30000);
            }
        } catch (error) {
            console.error("Error initializing in-app ads:", error);
        }
    }
    
    showInAppAd() {
        if (window.AdBlock2 && typeof window.AdBlock2.show === 'function') {
            window.AdBlock2.show().catch(() => {});
        }
    }

    async initializeFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded');
            }
            
            let firebaseConfig;
            try {
                const response = await fetch('/api/firebase-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-telegram-user': this.tgUser?.id?.toString() || '',
                        'x-telegram-auth': this.tg?.initData || ''
                    }
                });
                
                if (response.ok) {
                    firebaseConfig = await response.json();
                } else {
                    throw new Error('Failed to load Firebase config from API');
                }
            } catch (apiError) {
                firebaseConfig = {
                    apiKey: "fallback-key-123",
                    authDomain: "fallback.firebaseapp.com",
                    databaseURL: "https://fallback-default-rtdb.firebaseio.com",
                    projectId: "fallback-project",
                    storageBucket: "fallback.firebasestorage.app",
                    messagingSenderId: "1234567890",
                    appId: "1:1234567890:web:abcdef123456",
                    measurementId: "G-XXXXXXX"
                };
            }
            
            let firebaseApp;
            
            try {
                firebaseApp = firebase.initializeApp(firebaseConfig);
            } catch (error) {
                if (error.code === 'app/duplicate-app') {
                    firebaseApp = firebase.app();
                } else {
                    throw error;
                }
            }
            
            this.db = firebaseApp.database();
            this.auth = firebaseApp.auth();
            
            try {
                await this.auth.signInAnonymously();
            } catch (authError) {
                const randomEmail = `user_${this.tgUser.id}_${Date.now()}@tornado.app`;
                const randomPassword = Math.random().toString(36).slice(-10) + Date.now().toString(36);
                
                await this.auth.createUserWithEmailAndPassword(randomEmail, randomPassword);
            }
            
            await new Promise((resolve, reject) => {
                const unsubscribe = this.auth.onAuthStateChanged((user) => {
                    if (user) {
                        unsubscribe();
                        this.currentUser = user;
                        resolve(user);
                    }
                });
                
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Authentication timeout'));
                }, 10000);
            });
            
            this.firebaseInitialized = true;
            
            return true;
            
        } catch (error) {
            console.error("Firebase initialization error:", error);
            this.notificationManager?.showNotification(
                "Authentication Error",
                "Failed to connect to database. Some features may not work.",
                "error"
            );
            
            return false;
        }
    }

    setupFirebaseAuth() {
        if (!this.auth) return;
        
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                
                if (this.userState.firebaseUid !== user.uid) {
                    this.userState.firebaseUid = user.uid;
                    await this.syncUserWithFirebase();
                }
            } else {
                try {
                    await this.auth.signInAnonymously();
                } catch (error) {
                    console.error("Auth error:", error);
                }
            }
        });
    }

    async syncUserWithFirebase() {
        try {
            if (!this.db || !this.auth.currentUser) {
                return;
            }
            
            const firebaseUid = this.auth.currentUser.uid;
            const telegramId = this.tgUser.id;
            
            const userRef = this.db.ref(`users/${telegramId}`);
            const userSnapshot = await userRef.once('value');
            
            if (!userSnapshot.exists()) {
                const userData = {
                    ...this.getDefaultUserState(),
                    firebaseUid: firebaseUid,
                    telegramId: telegramId,
                    createdAt: this.getServerTime(),
                    lastSynced: this.getServerTime()
                };
                
                await userRef.set(userData);
            } else {
                await userRef.update({
                    firebaseUid: firebaseUid,
                    lastSynced: this.getServerTime()
                });
            }
            
        } catch (error) {
            console.error("Sync user with Firebase error:", error);
        }
    }

    async loadUserData(forceRefresh = false) {
        const cacheKey = `user_${this.tgUser.id}`;
        
        if (!forceRefresh) {
            const cachedData = this.cache.get(cacheKey);
            if (cachedData) {
                this.userState = cachedData;
                this.updateHeader();
                return;
            }
        }
        
        try {
            if (!this.db || !this.firebaseInitialized || !this.auth?.currentUser) {
                this.userState = this.getDefaultUserState();
                this.updateHeader();
                
                if (this.auth && !this.auth.currentUser) {
                    setTimeout(() => {
                        this.initializeFirebase();
                    }, 2000);
                }
                
                return;
            }
            
            const telegramId = this.tgUser.id;
            
            const userRef = this.db.ref(`users/${telegramId}`);
            const userSnapshot = await userRef.once('value');
            
            let userData;
            
            if (userSnapshot.exists()) {
                userData = userSnapshot.val();
                userData = await this.updateExistingUser(userRef, userData);
            } else {
                userData = await this.createNewUser(userRef);
            }
            
            if (userData.firebaseUid !== this.auth.currentUser.uid) {
                await userRef.update({
                    firebaseUid: this.auth.currentUser.uid,
                    lastUpdated: this.getServerTime()
                });
                userData.firebaseUid = this.auth.currentUser.uid;
            }
            
            this.userState = userData;
            this.cache.set(cacheKey, userData, 60000);
            this.updateHeader();
            
        } catch (error) {
            console.error("Load user data error:", error);
            this.userState = this.getDefaultUserState();
            this.updateHeader();
            
            this.notificationManager?.showNotification(
                "Data Sync Error",
                "Using local data. Will sync when connection improves.",
                "warning"
            );
        }
    }

    getDefaultUserState() {
        return {
            id: this.tgUser.id,
            username: this.tgUser.username ? `@${this.tgUser.username}` : 'No Username',
            telegramId: this.tgUser.id,
            firstName: this.getShortName(this.tgUser.first_name || 'User'),
            photoUrl: this.tgUser.photo_url || 'https://cdn-icons-png.flaticon.com/512/9195/9195920.png',
            balance: 0,
            referrals: 0,
            referralCode: this.generateReferralCode(),
            totalEarned: 0,
            totalTasks: 0,
            totalWithdrawals: 0,
            totalAds: 0,
            totalPromoCodes: 0,
            totalTasksCompleted: 0,
            completedTasks: [],
            referralEarnings: 0,
            lastDailyCheckin: 0,
            status: 'free',
            lastUpdated: this.getServerTime(),
            firebaseUid: this.auth?.currentUser?.uid || null,
            welcomeTasksCompleted: false,
            welcomeMessageSent: false,
            totalWithdrawnTON: 0,
            watchedAds: 0,
            joinedAt: this.getServerTime()
        };
    }

    async createNewUser(userRef) {
        const multiAccountAllowed = await this.checkMultiAccount(this.tgUser.id, false);
        if (!multiAccountAllowed) {
            return this.getDefaultUserState();
        }
        
        let referralId = null;
        const startParam = this.tg?.initDataUnsafe?.start_param;
        
        if (startParam) {
            referralId = this.extractReferralId(startParam);
            
            if (referralId && referralId > 0 && referralId !== this.tgUser.id) {
                const referrerRef = this.db.ref(`users/${referralId}`);
                const referrerSnapshot = await referrerRef.once('value');
                if (referrerSnapshot.exists()) {
                    this.pendingReferralAfterWelcome = referralId;
                    
                    await this.db.ref(`referrals/${referralId}/${this.tgUser.id}`).set({
                        userId: this.tgUser.id,
                        username: this.tgUser.username ? `@${this.tgUser.username}` : 'No Username',
                        firstName: this.getShortName(this.tgUser.first_name || ''),
                        photoUrl: this.tgUser.photo_url || 'https://cdn-icons-png.flaticon.com/512/9195/9195920.png',
                        joinedAt: this.getServerTime(),
                        state: 'pending',
                        bonusGiven: false,
                        bonusAmount: this.appConfig.REFERRAL_BONUS_TON,
                        verifiedAt: null
                    });
                } else {
                    referralId = null;
                }
            } else {
                referralId = null;
            }
        }
        
        const currentTime = this.getServerTime();
        const userData = {
            id: this.tgUser.id,
            username: this.tgUser.username ? `@${this.tgUser.username}` : 'No Username',
            telegramId: this.tgUser.id,
            firstName: this.getShortName(this.tgUser.first_name || ''),
            photoUrl: this.tgUser.photo_url || 'https://cdn-icons-png.flaticon.com/512/9195/9195920.png',
            balance: 0,
            referrals: 0,
            referredBy: referralId,
            referralCode: this.generateReferralCode(),
            totalEarned: 0,
            totalTasks: 0,
            totalWithdrawals: 0,
            totalAds: 0,
            totalPromoCodes: 0,
            totalTasksCompleted: 0,
            referralEarnings: 0,
            completedTasks: [],
            lastWithdrawalDate: null,
            lastDailyCheckin: 0,
            createdAt: currentTime,
            joinedAt: currentTime,
            lastActive: currentTime,
            status: 'free',
            referralState: referralId ? 'pending' : null,
            firebaseUid: this.auth?.currentUser?.uid || null,
            welcomeTasksCompleted: false,
            welcomeTasksCompletedAt: null,
            welcomeMessageSent: false,
            totalWithdrawnTON: 0,
            watchedAds: 0
        };
        
        await userRef.set(userData);
        
        try {
            await this.updateAppStats('totalUsers', 1);
        } catch (statsError) {}
        
        return userData;
    }

    async checkMultiAccount(tgId, showBanPage = true) {
        try {
            const ip = await this.getUserIP();
            if (!ip) return true;
            
            const ipData = JSON.parse(localStorage.getItem("ip_records")) || {};
            
            if (ipData[ip] && ipData[ip] !== tgId) {
                if (showBanPage) {
                    this.showMultiAccountBanPage();
                }
                
                try {
                    if (this.db) {
                        await this.db.ref(`users/${tgId}`).update({
                            status: 'ban',
                            banReason: 'Multiple accounts detected on same IP',
                            bannedAt: this.getServerTime()
                        });
                    }
                } catch (error) {}
                
                return false;
            }
            
            if (!ipData[ip]) {
                ipData[ip] = tgId;
                localStorage.setItem("ip_records", JSON.stringify(ipData));
            }
            
            return true;
        } catch (error) {
            return true;
        }
    }

    showMultiAccountBanPage() {
        document.body.innerHTML = `
            <div class="banned-container">
                <div class="banned-content">
                    <div class="banned-header">
                        <div class="banned-icon">
                            <i class="fas fa-ban"></i>
                        </div>
                        <h2>Multi accounts not allowed</h2>
                        <p>Access for this device has been blocked</p>
                    </div>
                    
                    <div class="ban-reason">
                        <div class="ban-reason-icon">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <h3>Ban Reason</h3>
                        <p>Multiple Telegram accounts detected on the same IP</p>
                    </div>
                </div>
            </div>
        `;
    }

    async getUserIP() {
        try {
            const res = await fetch("https://api.ipify.org?format=json");
            const data = await res.json();
            return data.ip;
        } catch (e) {
            return null;
        }
    }

    async updateExistingUser(userRef, userData) {
        const currentTime = this.getServerTime();
        await userRef.update({ 
            lastActive: currentTime,
            username: this.tgUser.username ? `@${this.tgUser.username}` : 'No Username',
            firstName: userData.firstName || this.getShortName(this.tgUser.first_name || 'User')
        });
        
        if (userData.completedTasks && Array.isArray(userData.completedTasks)) {
            this.userCompletedTasks = new Set(userData.completedTasks);
        } else {
            this.userCompletedTasks = new Set();
            userData.completedTasks = [];
            await userRef.update({ completedTasks: [] });
        }
        
        const defaultData = {
            referralCode: userData.referralCode || this.generateReferralCode(),
            lastDailyCheckin: userData.lastDailyCheckin || 0,
            status: userData.status || 'free',
            referralState: userData.referralState || 'verified',
            referralEarnings: userData.referralEarnings || 0,
            totalEarned: userData.totalEarned || 0,
            totalTasks: userData.totalTasks || 0,
            totalWithdrawals: userData.totalWithdrawals || 0,
            totalAds: userData.totalAds || 0,
            totalPromoCodes: userData.totalPromoCodes || 0,
            totalTasksCompleted: userData.totalTasksCompleted || 0,
            balance: userData.balance || 0,
            referrals: userData.referrals || 0,
            firebaseUid: this.auth?.currentUser?.uid || userData.firebaseUid || null,
            welcomeTasksCompleted: userData.welcomeTasksCompleted || false,
            welcomeTasksCompletedAt: userData.welcomeTasksCompletedAt || null,
            welcomeMessageSent: userData.welcomeMessageSent || false,
            totalWithdrawnTON: userData.totalWithdrawnTON || 0,
            watchedAds: userData.watchedAds || 0,
            joinedAt: userData.joinedAt || userData.createdAt || currentTime
        };
        
        const updates = {};
        Object.keys(defaultData).forEach(key => {
            if (userData[key] === undefined) {
                updates[key] = defaultData[key];
                userData[key] = defaultData[key];
            }
        });
        
        if (Object.keys(updates).length > 0) {
            await userRef.update(updates);
        }
        
        return userData;
    }

    extractReferralId(startParam) {
        if (!startParam) return null;
        
        if (!isNaN(startParam)) {
            return parseInt(startParam);
        } else if (startParam.includes('startapp=')) {
            const match = startParam.match(/startapp=(\d+)/);
            if (match && match[1]) {
                return parseInt(match[1]);
            }
        } else if (startParam.includes('=')) {
            const parts = startParam.split('=');
            if (parts.length > 1 && !isNaN(parts[1])) {
                return parseInt(parts[1]);
            }
        }
        
        return null;
    }

    async processReferralRegistrationWithBonus(referrerId, newUserId) {
        try {
            if (!this.db) return;
            
            const referrerRef = this.db.ref(`users/${referrerId}`);
            const referrerSnapshot = await referrerRef.once('value');
            
            if (!referrerSnapshot.exists()) return;
            
            const referrerData = referrerSnapshot.val();
            
            if (referrerData.status === 'ban') return;
            
            const referralBonus = this.appConfig.REFERRAL_BONUS_TON;
            
            const newBalance = this.safeNumber(referrerData.balance) + referralBonus;
            const newReferrals = (referrerData.referrals || 0) + 1;
            const newReferralEarnings = this.safeNumber(referrerData.referralEarnings) + referralBonus;
            const newTotalEarned = this.safeNumber(referrerData.totalEarned) + referralBonus;
            const currentTime = this.getServerTime();
            
            await referrerRef.update({
                balance: newBalance,
                referrals: newReferrals,
                referralEarnings: newReferralEarnings,
                totalEarned: newTotalEarned
            });
            
            await this.db.ref(`referrals/${referrerId}/${newUserId}`).update({
                state: 'verified',
                bonusGiven: true,
                verifiedAt: currentTime,
                bonusAmount: referralBonus
            });
            
            await this.db.ref(`users/${newUserId}`).update({
                referralState: 'verified'
            });
            
            if (this.tgUser && referrerId === this.tgUser.id) {
                this.userState.balance = newBalance;
                this.userState.referrals = newReferrals;
                this.userState.referralEarnings = newReferralEarnings;
                this.userState.totalEarned = newTotalEarned;
                
                this.updateHeader();
            }
            
            await this.refreshReferralsList();
            
        } catch (error) {
            console.error("Process referral bonus error:", error);
        }
    }

    async processReferralTaskBonus(referrerId, taskReward) {
        try {
            if (!this.db) return;
            if (!referrerId || referrerId === this.tgUser.id) return;
            
            const referrerRef = this.db.ref(`users/${referrerId}`);
            const referrerSnapshot = await referrerRef.once('value');
            
            if (!referrerSnapshot.exists()) return;
            
            const referrerData = referrerSnapshot.val();
            
            if (referrerData.status === 'ban') return;
            
            const referralPercentage = this.appConfig.REFERRAL_PERCENTAGE;
            const referralBonus = (taskReward * referralPercentage) / 100;
            
            if (referralBonus <= 0) return;
            
            const newBalance = this.safeNumber(referrerData.balance) + referralBonus;
            const newReferralEarnings = this.safeNumber(referrerData.referralEarnings) + referralBonus;
            const newTotalEarned = this.safeNumber(referrerData.totalEarned) + referralBonus;
            
            await referrerRef.update({
                balance: newBalance,
                referralEarnings: newReferralEarnings,
                totalEarned: newTotalEarned
            });
            
            await this.db.ref(`referralTasks/${referrerId}`).push({
                userId: this.tgUser.id,
                taskReward: taskReward,
                referralBonus: referralBonus,
                percentage: referralPercentage,
                createdAt: this.getServerTime()
            });
            
            if (referrerId === this.tgUser.id) {
                this.userState.balance = newBalance;
                this.userState.referralEarnings = newReferralEarnings;
                this.userState.totalEarned = newTotalEarned;
                
                this.updateHeader();
            }
            
        } catch (error) {
            console.error("Process referral task bonus error:", error);
        }
    }

    async loadTasksData() {
        try {
            if (this.taskManager) {
                return await this.taskManager.loadTasksData();
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    async loadHistoryData() {
        try {
            if (!this.db) {
                this.userWithdrawals = [];
                return;
            }
            
            const statuses = ['pending', 'completed', 'rejected'];
            const withdrawalPromises = statuses.map(status => 
                this.db.ref(`withdrawals/${status}`).orderByChild('userId').equalTo(this.tgUser.id).once('value')
            );
            
            const withdrawalSnapshots = await Promise.all(withdrawalPromises);
            this.userWithdrawals = [];
            
            withdrawalSnapshots.forEach(snap => {
                snap.forEach(child => {
                    this.userWithdrawals.push({ id: child.key, ...child.val() });
                });
            });
            
            this.userWithdrawals.sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp));
            
        } catch (error) {
            this.userWithdrawals = [];
        }
    }

    async loadAppStats() {
        try {
            if (!this.db) {
                this.appStats = {
                    totalUsers: 0,
                    onlineUsers: 0,
                    totalPayments: 0,
                    totalWithdrawals: 0
                };
                return;
            }
            
            const statsSnapshot = await this.db.ref('appStats').once('value');
            if (statsSnapshot.exists()) {
                const stats = statsSnapshot.val();
                const totalUsers = this.safeNumber(stats.totalUsers || 0);
                const minOnline = Math.floor(totalUsers * 0.05);
                const maxOnline = Math.floor(totalUsers * 0.20);
                const onlineUsers = Math.floor(Math.random() * (maxOnline - minOnline + 1)) + minOnline;
                
                this.appStats = {
                    totalUsers: totalUsers,
                    onlineUsers: Math.max(onlineUsers, Math.floor(totalUsers * 0.05)),
                    totalPayments: this.safeNumber(stats.totalPayments || 0),
                    totalWithdrawals: this.safeNumber(stats.totalWithdrawals || 0)
                };
            } else {
                this.appStats = {
                    totalUsers: 0,
                    onlineUsers: 0,
                    totalPayments: 0,
                    totalWithdrawals: 0
                };
                await this.db.ref('appStats').set(this.appStats);
            }
            
        } catch (error) {
            this.appStats = {
                totalUsers: 0,
                onlineUsers: 0,
                totalPayments: 0,
                totalWithdrawals: 0
            };
        }
    }

    async updateAppStats(stat, value = 1) {
        try {
            if (!this.db) return;
            
            if (stat === 'totalUsers') {
                const newTotal = (this.appStats.totalUsers || 0) + value;
                const minOnline = Math.floor(newTotal * 0.05);
                const maxOnline = Math.floor(newTotal * 0.20);
                const onlineUsers = Math.floor(Math.random() * (maxOnline - minOnline + 1)) + minOnline;
                
                await this.db.ref('appStats/onlineUsers').set(Math.max(onlineUsers, Math.floor(newTotal * 0.05)));
            }
            
            await this.db.ref(`appStats/${stat}`).transaction(current => (current || 0) + value);
            this.appStats[stat] = (this.appStats[stat] || 0) + value;
            
            if (stat === 'totalUsers') {
                await this.loadAppStats();
            }
        } catch (error) {}
    }

    async showWelcomeTasksModal() {
        if (this.userState.welcomeTasksCompleted) {
            this.showPage('tasks-page');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'welcome-tasks-modal';
        
        const welcomeTasksHTML = this.appConfig.WELCOME_TASKS.map((task, index) => `
            <div class="welcome-task-item" id="welcome-task-${index}">
                <div class="welcome-task-info">
                    <h4>${task.name}</h4>
                </div>
                <button class="welcome-task-btn" id="welcome-task-btn-${index}" 
                        data-url="${task.url}" 
                        data-channel="${task.channel}">
                    <i class="fas fa-external-link-alt"></i> Join
                </button>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="welcome-tasks-content">
                <div class="welcome-header">
                    <div class="welcome-icon">
                        <i class="fas fa-gift"></i>
                    </div>
                    <h3>Welcome Tasks</h3>
                    <p>Join all channels to claim your bonus</p>
                </div>
                
                <div class="welcome-tasks-list">
                    ${welcomeTasksHTML}
                </div>
                
                <div class="welcome-footer">
                    <button class="check-welcome-btn" id="check-welcome-btn" disabled>
                        <i class="fas fa-check-circle"></i> Check & Get 0.005 TON
                    </button>
                    <p>
                        <i class="fas fa-info-circle"></i> Join all ${this.appConfig.WELCOME_TASKS.length} channels then click CHECK
                    </p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const app = this;
        const clickedTasks = {};
        
        this.appConfig.WELCOME_TASKS.forEach((task, index) => {
            clickedTasks[index] = false;
        });
        
        function updateCheckButton() {
            const checkBtn = document.getElementById('check-welcome-btn');
            const allClicked = Object.values(clickedTasks).every(v => v === true);
            
            if (allClicked && checkBtn) {
                checkBtn.disabled = false;
            }
        }
        
        this.appConfig.WELCOME_TASKS.forEach((task, index) => {
            const btn = document.getElementById(`welcome-task-btn-${index}`);
            if (btn) {
                btn.addEventListener('click', async () => {
                    const url = btn.getAttribute('data-url');
                    const channel = btn.getAttribute('data-channel');
                    
                    window.open(url, '_blank');
                    
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening...';
                    btn.disabled = true;
                    
                    setTimeout(async () => {
                        try {
                            const isMember = await app.checkTelegramMembership(channel);
                            
                            if (isMember) {
                                btn.innerHTML = '<i class="fas fa-check"></i> Checked';
                                btn.classList.add('completed');
                                clickedTasks[index] = true;
                            } else {
                                btn.innerHTML = '<i class="fas fa-times"></i> Failed';
                                btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                                clickedTasks[index] = false;
                                
                                app.notificationManager.showNotification(
                                    "Join Required", 
                                    `Please join ${channel} first`, 
                                    "error"
                                );
                            }
                            
                            updateCheckButton();
                            
                        } catch (error) {
                            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
                            btn.disabled = false;
                        }
                    }, 10000);
                });
            }
        });
        
        const checkBtn = document.getElementById('check-welcome-btn');
        if (checkBtn) {
            checkBtn.addEventListener('click', async () => {
                if (checkBtn.disabled) return;
                
                checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
                checkBtn.disabled = true;
                
                try {
                    const verificationResult = await app.verifyWelcomeTasks();
                    
                    if (verificationResult.success) {
                        await app.completeWelcomeTasks();
                        modal.remove();
                        app.showPage('tasks-page');
                        app.notificationManager.showNotification("Success", "Welcome tasks completed! +0.005 TON", "success");
                    } else {
                        checkBtn.innerHTML = '<i class="fas fa-check-circle"></i> Check & Get 0.005 TON';
                        checkBtn.disabled = false;
                        
                        if (verificationResult.missing.length > 0) {
                            const missingItems = verificationResult.missing.map(item => {
                                const task = app.appConfig.WELCOME_TASKS.find(t => t.channel === item);
                                return task ? task.name : item;
                            }).join(', ');
                            
                            app.notificationManager.showNotification(
                                "Verification Failed", 
                                `Please join: ${missingItems}`, 
                                "error"
                            );
                        }
                    }
                } catch (error) {
                    app.notificationManager.showNotification("Error", "Failed to verify tasks", "error");
                    checkBtn.innerHTML = '<i class="fas fa-check-circle"></i> Check & Get 0.005 TON';
                    checkBtn.disabled = false;
                }
            });
        }
        
        this.welcomeTasksShown = true;
    }
    
    async verifyWelcomeTasks() {
        try {
            const channelsToCheck = this.appConfig.WELCOME_TASKS.map(task => task.channel);
            const missingChannels = [];
            const verifiedChannels = [];
            
            for (const channel of channelsToCheck) {
                const isMember = await this.checkTelegramMembership(channel);
                
                if (isMember) {
                    verifiedChannels.push(channel);
                } else {
                    missingChannels.push(channel);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            return {
                success: missingChannels.length === 0,
                verified: verifiedChannels,
                missing: missingChannels
            };
            
        } catch (error) {
            return {
                success: false,
                verified: [],
                missing: this.appConfig.WELCOME_TASKS.map(task => task.channel)
            };
        }
    }
    
    async checkTelegramMembership(channelUsername) {
        try {
            if (!this.tgUser || !this.tgUser.id) {
                return false;
            }
            
            const response = await fetch('/api/telegram-bot', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': this.tgUser.id.toString(),
                    'x-telegram-hash': this.tg?.initData || ''
                },
                body: JSON.stringify({
                    action: 'getChatMember',
                    params: {
                        chat_id: channelUsername,
                        user_id: this.tgUser.id
                    }
                })
            });
            
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            
            if (data.ok && data.result) {
                const status = data.result.status;
                const isMember = (status === 'member' || status === 'administrator' || 
                                status === 'creator' || status === 'restricted');
                return isMember;
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }
    
    async completeWelcomeTasks() {
        try {
            const reward = 0.005;
            const currentBalance = this.safeNumber(this.userState.balance);
            const newBalance = currentBalance + reward;
            const currentTime = this.getServerTime();
            
            const updates = {
                balance: newBalance,
                totalEarned: this.safeNumber(this.userState.totalEarned) + reward,
                totalTasks: this.safeNumber(this.userState.totalTasks) + 1,
                welcomeTasksCompleted: true,
                welcomeTasksCompletedAt: currentTime,
                welcomeTasksVerifiedAt: currentTime,
                referralState: 'verified',
                lastUpdated: currentTime
            };
            
            if (this.db) {
                await this.db.ref(`users/${this.tgUser.id}`).update(updates);
                
                if (this.userState.referredBy) {
                    await this.processReferralRegistrationWithBonus(this.userState.referredBy, this.tgUser.id);
                }
            }
            
            this.userState.balance = newBalance;
            this.userState.totalEarned = this.safeNumber(this.userState.totalEarned) + reward;
            this.userState.totalTasks = this.safeNumber(this.userState.totalTasks) + 1;
            this.userState.welcomeTasksCompleted = true;
            this.userState.welcomeTasksCompletedAt = currentTime;
            this.userState.welcomeTasksVerifiedAt = currentTime;
            this.userState.referralState = 'verified';
            
            if (this.pendingReferralAfterWelcome && this.pendingReferralAfterWelcome !== this.tgUser.id) {
                await this.processReferralRegistrationWithBonus(this.pendingReferralAfterWelcome, this.tgUser.id);
                this.userState.referredBy = this.pendingReferralAfterWelcome;
                this.pendingReferralAfterWelcome = null;
            }
            
            this.cache.delete(`user_${this.tgUser.id}`);
            this.updateHeader();
            
            await this.refreshReferralsList();
            
            return true;
        } catch (error) {
            return false;
        }
    }

    startReferralMonitor() {
        if (this.referralMonitorInterval) {
            clearInterval(this.referralMonitorInterval);
        }
        
        this.referralMonitorInterval = setInterval(async () => {
            await this.checkReferralsVerification();
        }, 30000);
    }

    async checkReferralsVerification() {
        try {
            if (!this.db || !this.tgUser) return;
            
            const referralsRef = await this.db.ref(`referrals/${this.tgUser.id}`).once('value');
            if (!referralsRef.exists()) return;
            
            const referrals = referralsRef.val();
            let updated = false;
            
            for (const referralId in referrals) {
                const referral = referrals[referralId];
                
                if (referral.state === 'pending') {
                    const newUserRef = await this.db.ref(`users/${referralId}`).once('value');
                    if (newUserRef.exists()) {
                        const newUserData = newUserRef.val();
                        
                        if (newUserData.welcomeTasksCompleted) {
                            await this.processReferralRegistrationWithBonus(this.tgUser.id, referralId);
                            updated = true;
                        }
                    }
                }
            }
            
            if (updated) {
                this.cache.delete(`user_${this.tgUser.id}`);
                this.cache.delete(`referrals_${this.tgUser.id}`);
                
                if (document.getElementById('referrals-page')?.classList.contains('active')) {
                    this.renderReferralsPage();
                }
            }
            
        } catch (error) {
            console.error("Check referrals verification error:", error);
        }
    }

    async loadAdTimers() {
        try {
            if (this.db) {
                const timersRef = await this.db.ref(`userAdTimers/${this.tgUser.id}`).once('value');
                if (timersRef.exists()) {
                    const data = timersRef.val();
                    this.adTimers = {
                        ad1: data.ad1 || 0
                    };
                    return;
                }
            }
            
            const savedTimers = localStorage.getItem(`ad_timers_${this.tgUser.id}`);
            if (savedTimers) {
                this.adTimers = JSON.parse(savedTimers);
            }
        } catch (error) {
            this.adTimers = {
                ad1: 0
            };
        }
    }

    async saveAdTimers() {
        try {
            const currentTime = this.getServerTime();
            if (this.db) {
                await this.db.ref(`userAdTimers/${this.tgUser.id}`).set({
                    ad1: this.adTimers.ad1,
                    lastUpdated: currentTime
                });
            }
            
            localStorage.setItem(`ad_timers_${this.tgUser.id}`, JSON.stringify(this.adTimers));
        } catch (error) {
            console.error("Save ad timers error:", error);
        }
    }

    setupTelegramTheme() {
        if (!this.tg) return;
        
        this.darkMode = true;
        document.body.classList.add('dark-mode');
        
        this.tg.onEvent('themeChanged', () => {
            this.darkMode = true;
            document.body.classList.add('dark-mode');
        });
    }

    showLoadingProgress(percent) {
        const progressBar = document.getElementById('loading-progress-bar');
        if (progressBar) {
            progressBar.style.width = percent + '%';
            progressBar.style.transition = 'width 0.3s ease';
        }
        
        const loadingPercentage = document.getElementById('loading-percentage');
        if (loadingPercentage) {
            loadingPercentage.textContent = `${percent}%`;
        }
    }

    showError(message) {
        document.body.innerHTML = `
            <div class="error-container">
                <div class="error-content">
                    <div class="error-header">
                        <div class="error-icon">
                            <i class="fab fa-telegram"></i>
                        </div>
                        <h2>Tornado TON</h2>
                    </div>
                    
                    <div class="error-message">
                        <div class="error-icon-wrapper">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3>Error</h3>
                        <p>${message}</p>
                    </div>
                    
                    <button onclick="window.location.reload()" class="reload-btn">
                        <i class="fas fa-redo"></i> Reload App
                    </button>
                </div>
            </div>
        `;
    }

    showBannedPage() {
        document.body.innerHTML = `
            <div class="banned-container">
                <div class="banned-content">
                    <div class="banned-header">
                        <div class="banned-icon">
                            <i class="fas fa-ban"></i>
                        </div>
                        <h2>Account Banned</h2>
                        <p>Your account has been suspended</p>
                    </div>
                    
                    <div class="ban-reason">
                        <div class="ban-reason-icon">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <h3>Ban Reason</h3>
                        <p>${this.userState.banReason || 'Violation of terms'}</p>
                    </div>
                </div>
            </div>
        `;
    }

    updateHeader() {
        const userPhoto = document.getElementById('user-photo');
        const userName = document.getElementById('user-name');
        const tonBalance = document.getElementById('header-ton-balance');
        
        if (userPhoto) {
            userPhoto.src = this.userState.photoUrl || 'https://cdn-icons-png.flaticon.com/512/9195/9195920.png';
            userPhoto.style.width = '70px';
            userPhoto.style.height = '70px';
            userPhoto.style.borderRadius = '50%';
            userPhoto.style.objectFit = 'cover';
            userPhoto.style.border = '3px solid #3b82f6';
            userPhoto.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.3)';
            userPhoto.oncontextmenu = (e) => e.preventDefault();
            userPhoto.ondragstart = () => false;
        }
        
        if (userName) {
            const fullName = this.tgUser.first_name || 'User';
            userName.textContent = this.truncateName(fullName, 20);
            userName.style.fontSize = '1.4rem';
            userName.style.fontWeight = '700';
            userName.style.color = 'white';
            userName.style.margin = '0 0 8px 0';
            userName.style.whiteSpace = 'nowrap';
            userName.style.overflow = 'hidden';
            userName.style.textOverflow = 'ellipsis';
            userName.style.lineHeight = '1.2';
        }
        
        if (tonBalance) {
            const balance = this.safeNumber(this.userState.balance);
            tonBalance.innerHTML = `<b>${balance.toFixed(5)} TON</b>`;
            tonBalance.style.fontSize = '1.2rem';
            tonBalance.style.fontWeight = '700';
            tonBalance.style.color = '#3b82f6';
            tonBalance.style.fontFamily = 'monospace';
            tonBalance.style.margin = '0';
            tonBalance.style.whiteSpace = 'nowrap';
        }
    }

    renderUI() {
        this.updateHeader();
        this.renderTasksPage();
        this.renderReferralsPage();
        this.renderProfilePage();
        this.setupNavigation();
        this.setupEventListeners();
        
        document.body.addEventListener('copy', (e) => {
            e.preventDefault();
            return false;
        });
        
        document.body.addEventListener('contextmenu', (e) => {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                return false;
            }
        });
    }

    setupNavigation() {
        const bottomNav = document.querySelector('.bottom-nav');
        if (!bottomNav) return;
        
        const navButtons = bottomNav.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pageId = btn.getAttribute('data-page');
                if (pageId) {
                    this.showPage(pageId);
                }
            });
        });
    }

    showPage(pageId) {
        const pages = document.querySelectorAll('.page');
        const navButtons = document.querySelectorAll('.nav-btn');
        
        pages.forEach(page => page.classList.remove('active'));
        navButtons.forEach(btn => btn.classList.remove('active'));
        
        const targetPage = document.getElementById(pageId);
        const targetButton = document.querySelector(`[data-page="${pageId}"]`);
        
        if (targetPage) {
            targetPage.classList.add('active');
            
            if (targetButton) targetButton.classList.add('active');
            
            if (pageId === 'tasks-page') {
                this.renderTasksPage();
            } else if (pageId === 'referrals-page') {
                this.renderReferralsPage();
            } else if (pageId === 'profile-page') {
                this.renderProfilePage();
            }
        }
    }

    renderTasksPage() {
        const tasksPage = document.getElementById('tasks-page');
        if (!tasksPage) return;
        
        tasksPage.innerHTML = `
            <div id="tasks-content">
                <div class="tasks-tabs">
                    <button class="tab-btn active" data-tab="social-tab">
                        <i class="fas fa-users"></i> Social
                    </button>
                    <button class="tab-btn" data-tab="partner-tab">
                        <i class="fas fa-handshake"></i> Partner
                    </button>
                    <button class="tab-btn" data-tab="more-tab">
                        <i class="fas fa-ellipsis-h"></i> More
                    </button>
                </div>
                
                <div id="social-tab" class="tasks-tab-content active">
                    <div class="add-task-card">
                        <div class="add-task-header">
                            <i class="fas fa-plus-circle"></i>
                            <h4>Add Your Task</h4>
                        </div>
                        <p>Promote your channel or group</p>
                        <button id="add-task-btn" class="add-task-btn">
                            <i class="fas fa-plus"></i> Add Task
                        </button>
                    </div>
                    <div id="social-tasks-container"></div>
                </div>
                <div id="partner-tab" class="tasks-tab-content"></div>
                <div id="more-tab" class="tasks-tab-content">
                    <div class="promo-card">
                        <div class="promo-header">
                            <div class="promo-icon">
                                <i class="fas fa-gift"></i>
                            </div>
                            <h3>Promo Codes</h3>
                        </div>
                        <input type="text" id="promo-input" class="promo-input" 
                               placeholder="Enter promo code" maxlength="20">
                        <button id="promo-btn" class="promo-btn">
                            <i class="fas fa-gift"></i> APPLY
                        </button>
                    </div>
                    <div class="ad-card">
                        <div class="ad-header">
                            <div class="ad-icon">
                                <i class="fas fa-ad"></i>
                            </div>
                            <div class="ad-title">Watch AD #1</div>
                        </div>
                        <div class="ad-reward">
                            <img src="https://cdn-icons-png.flaticon.com/512/15208/15208522.png" alt="TON">
                            <span>Reward: 0.001 TON</span>
                        </div>
                        <button class="ad-btn ${this.isAdAvailable(1) ? 'available' : 'cooldown'}" 
                                id="watch-ad-1-btn"
                                ${!this.isAdAvailable(1) ? 'disabled' : ''}>
                            ${this.isAdAvailable(1) ? 'WATCH' : this.formatTime(this.getAdTimeLeft(1))}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            this.setupTasksTabs();
            this.renderTasksTabContent();
            this.setupPromoCodeEvents();
            this.setupAdWatchEvents();
            this.startAdTimers();
            this.setupAddTaskButton();
        }, 100);
    }

    setupTasksTabs() {
        const tabButtons = document.querySelectorAll('.tasks-tabs .tab-btn');
        const tabContents = document.querySelectorAll('.tasks-tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                button.classList.add('active');
                const targetTab = document.getElementById(tabId);
                if (targetTab) {
                    targetTab.classList.add('active');
                    
                    if (tabId === 'social-tab' && targetTab.innerHTML.includes('social-tasks-container')) {
                        this.loadSocialTasks();
                    } else if (tabId === 'partner-tab' && targetTab.innerHTML === '') {
                        this.loadPartnerTasks();
                    }
                }
            });
        });
    }

    setupAddTaskButton() {
        const addTaskBtn = document.getElementById('add-task-btn');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                this.showAddTaskModal();
            });
        }
    }

    showAddTaskModal() {
        const modal = document.createElement('div');
        modal.className = 'add-task-modal';
        
        modal.innerHTML = `
            <div class="add-task-content">
                <div class="add-task-header">
                    <h3>Add New Task</h3>
                    <button class="close-modal">&times;</button>
                </div>
                
                <div class="add-task-body">
                    <div class="form-group">
                        <label><i class="fas fa-heading"></i> Task Name (max 20 chars)</label>
                        <input type="text" id="task-name" class="form-input" 
                               placeholder="e.g. Join My Channel" maxlength="20" required>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-link"></i> Task Link</label>
                        <input type="text" id="task-link" class="form-input" 
                               placeholder="https://t.me/..." required>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-bullseye"></i> Task Target</label>
                        <div class="task-target-grid">
                            ${Object.entries(this.appConfig.TASK_PRICES).map(([target, price]) => `
                                <div class="target-option" data-target="${target}" data-price="${price}">
                                    <div class="target-users">${target}</div>
                                    <div class="target-price">${price} TON</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-check-circle"></i> Task Check</label>
                        <div class="check-buttons">
                            <button type="button" class="check-btn" data-check="true">✅ Yes</button>
                            <button type="button" class="check-btn" data-check="false">❌ No</button>
                        </div>
                        <div id="check-note" class="check-note" style="display: none;">
                            <i class="fas fa-info-circle"></i> You must upgrade bot to admins
                        </div>
                    </div>
                </div>
                
                <div class="add-task-footer">
                    <button id="confirm-pay-btn" class="pay-btn" disabled>
                        <i class="fas fa-credit-card"></i> Confirm & Pay <span id="pay-amount">0.000</span> TON
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        this.setupAddTaskModalEvents(modal);
    }

    setupAddTaskModalEvents(modal) {
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        const targetOptions = modal.querySelectorAll('.target-option');
        targetOptions.forEach(option => {
            option.addEventListener('click', () => {
                targetOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                const price = option.dataset.price;
                const payAmount = modal.querySelector('#pay-amount');
                if (payAmount) payAmount.textContent = price;
                
                this.updateAddTaskButtonState(modal);
            });
        });
        
        const checkButtons = modal.querySelectorAll('.check-btn');
        const checkNote = modal.querySelector('#check-note');
        
        checkButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                checkButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                
                const needsBot = btn.dataset.check === 'true';
                if (checkNote) {
                    checkNote.style.display = needsBot ? 'block' : 'none';
                }
                
                this.updateAddTaskButtonState(modal);
            });
        });
        
        const taskNameInput = modal.querySelector('#task-name');
        const taskLinkInput = modal.querySelector('#task-link');
        const confirmPayBtn = modal.querySelector('#confirm-pay-btn');
        
        if (taskNameInput && taskLinkInput && confirmPayBtn) {
            taskNameInput.addEventListener('input', () => this.updateAddTaskButtonState(modal));
            taskLinkInput.addEventListener('input', () => this.updateAddTaskButtonState(modal));
        }
        
        if (confirmPayBtn) {
            confirmPayBtn.addEventListener('click', async () => {
                await this.processAddTask(modal);
            });
        }
        
        this.updateAddTaskButtonState(modal);
    }

    updateAddTaskButtonState(modal) {
        const taskName = modal.querySelector('#task-name');
        const taskLink = modal.querySelector('#task-link');
        const selectedTarget = modal.querySelector('.target-option.selected');
        const selectedCheck = modal.querySelector('.check-btn.selected');
        const confirmPayBtn = modal.querySelector('#confirm-pay-btn');
        
        if (!taskName || !taskLink || !selectedTarget || !selectedCheck || !confirmPayBtn) return;
        
        const name = taskName.value.trim();
        const link = taskLink.value.trim();
        const price = parseFloat(selectedTarget.dataset.price);
        const userBalance = this.safeNumber(this.userState.balance);
        
        confirmPayBtn.disabled = true;
        
        if (name && link && price && userBalance >= price) {
            confirmPayBtn.disabled = false;
        }
    }

    async processAddTask(modal) {
        const taskName = modal.querySelector('#task-name').value.trim();
        const taskLink = modal.querySelector('#task-link').value.trim();
        const selectedTarget = modal.querySelector('.target-option.selected');
        const selectedCheck = modal.querySelector('.check-btn.selected');
        const confirmPayBtn = modal.querySelector('#confirm-pay-btn');
        
        if (!taskName || !taskLink || !selectedTarget || !selectedCheck) return;
        
        const target = selectedTarget.dataset.target;
        const price = parseFloat(selectedTarget.dataset.price);
        const needsBot = selectedCheck.dataset.check === 'true';
        
        const userBalance = this.safeNumber(this.userState.balance);
        if (userBalance < price) {
            this.notificationManager.showNotification("Insufficient Balance", `You need ${price} TON`, "error");
            return;
        }
        
        if (needsBot) {
            const chatId = this.extractChatIdFromUrl(taskLink);
            if (chatId) {
                try {
                    const isBotAdmin = await this.checkBotAdminStatus(chatId);
                    if (!isBotAdmin) {
                        this.notificationManager.showNotification("Bot Admin Required", "You must add bot as admins", "error");
                        return;
                    }
                } catch (error) {
                    this.notificationManager.showNotification("Error", "Failed to check bot admin status", "error");
                    return;
                }
            }
        }
        
        if (confirmPayBtn) {
            confirmPayBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            confirmPayBtn.disabled = true;
        }
        
        try {
            const newBalance = userBalance - price;
            
            if (this.db) {
                await this.db.ref(`users/${this.tgUser.id}`).update({
                    balance: newBalance
                });
                
                const taskData = {
                    name: taskName,
                    url: taskLink,
                    type: 'channel',
                    category: 'social',
                    reward: 0.001,
                    currentCompletions: 0,
                    maxCompletions: parseInt(target),
                    createdBy: this.tgUser.id,
                    createdAt: this.getServerTime(),
                    status: 'active'
                };
                
                const newTaskRef = await this.db.ref('config/tasks').push(taskData);
                const taskId = newTaskRef.key;
                
                await this.db.ref(`userTasks/${this.tgUser.id}/${taskId}`).set({
                    taskId: taskId,
                    createdAt: this.getServerTime(),
                    price: price,
                    target: target
                });
            }
            
            this.userState.balance = newBalance;
            this.updateHeader();
            
            modal.remove();
            
            this.notificationManager.showNotification("Success", `Task added for ${price} TON`, "success");
            
            this.loadSocialTasks();
            
        } catch (error) {
            console.error("Add task error:", error);
            this.notificationManager.showNotification("Error", "Failed to add task", "error");
            
            if (confirmPayBtn) {
                confirmPayBtn.innerHTML = '<i class="fas fa-credit-card"></i> Confirm & Pay';
                confirmPayBtn.disabled = false;
            }
        }
    }

    extractChatIdFromUrl(url) {
        try {
            if (!url) return null;
            
            url = url.toString().trim();
            
            if (url.includes('t.me/')) {
                const match = url.match(/t\.me\/([^\/\?]+)/);
                if (match && match[1]) {
                    const username = match[1];
                    
                    if (username.startsWith('@')) return username;
                    
                    if (/^[a-zA-Z][a-zA-Z0-9_]{4,}$/.test(username)) return '@' + username;
                    
                    return username;
                }
            }
            
            return null;
            
        } catch (error) {
            return null;
        }
    }

    async checkBotAdminStatus(chatId) {
        try {
            if (!this.tgUser?.id) return false;
            
            const response = await fetch('/api/telegram-bot', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': this.tgUser.id.toString(),
                    'x-telegram-hash': this.tg?.initData || ''
                },
                body: JSON.stringify({
                    action: 'getChatAdministrators',
                    params: { chat_id: chatId }
                })
            });
            
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            if (data.ok && data.result) {
                const admins = data.result;
                const isBotAdmin = admins.some(admin => {
                    const isBot = admin.user?.is_bot;
                    const isThisBot = admin.user?.username === this.appConfig.BOT_USERNAME.replace('@', '');
                    return isBot && isThisBot;
                });
                return isBotAdmin;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async renderTasksTabContent() {
        await this.loadSocialTasks();
        await this.loadPartnerTasks();
    }

    async loadSocialTasks() {
        const socialContainer = document.getElementById('social-tasks-container');
        if (!socialContainer) return;
        
        try {
            let socialTasks = [];
            if (this.taskManager) {
                socialTasks = await this.taskManager.loadTasksFromDatabase('social');
            }
            
            if (socialTasks.length > 0) {
                const tasksHTML = socialTasks.map(task => this.renderTaskCard(task)).join('');
                socialContainer.innerHTML = `
                    <div class="task-section">
                        <h3 class="task-section-title"><i class="fas fa-users"></i> Social Tasks</h3>
                        <div class="tasks-list">
                            ${tasksHTML}
                        </div>
                    </div>
                `;
                this.setupTaskButtons();
            } else {
                socialContainer.innerHTML = `
                    <div class="no-tasks">
                        <i class="fas fa-users"></i>
                        <p>No social tasks available now</p>
                    </div>
                `;
            }
        } catch (error) {
            socialContainer.innerHTML = `
                <div class="no-tasks">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading social tasks</p>
                </div>
            `;
        }
    }

    async loadPartnerTasks() {
        const partnerTab = document.getElementById('partner-tab');
        if (!partnerTab) return;
        
        try {
            let partnerTasks = [];
            if (this.taskManager) {
                partnerTasks = await this.taskManager.loadTasksFromDatabase('partner');
            }
            
            if (partnerTasks.length > 0) {
                const tasksHTML = partnerTasks.map(task => this.renderTaskCard(task)).join('');
                partnerTab.innerHTML = `
                    <div class="task-section">
                        <h3 class="task-section-title"><i class="fas fa-handshake"></i> Partner Tasks</h3>
                        <div class="tasks-list">
                            ${tasksHTML}
                        </div>
                    </div>
                `;
                this.setupTaskButtons();
            } else {
                partnerTab.innerHTML = `
                    <div class="no-tasks">
                        <i class="fas fa-handshake"></i>
                        <p>No partner tasks available now</p>
                    </div>
                `;
            }
        } catch (error) {
            partnerTab.innerHTML = `
                <div class="no-tasks">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading partner tasks</p>
                </div>
            `;
        }
    }

    renderTaskCard(task) {
        const isCompleted = this.userCompletedTasks.has(task.id);
        const defaultIcon = 'https://i.ibb.co/GvWFRrnp/ninja.png';
        
        let buttonText = 'Start';
        let buttonClass = 'start';
        let isDisabled = isCompleted || this.isProcessingTask;
        
        if (isCompleted) {
            buttonText = 'COMPLETED';
            buttonClass = 'completed';
            isDisabled = true;
        }
        
        return `
            <div class="task-card ${isCompleted ? 'task-completed' : ''}" id="task-${task.id}">
                <div class="task-header">
                    <div class="task-icon">
                        <i class="fas ${task.type === 'channel' ? 'fa-users' : 'fa-gamepad'}"></i>
                    </div>
                    <div class="task-content">
                        <div class="task-title">${task.name}</div>
                        <div class="task-description">${task.description || 'Join & Get Reward'}</div>
                    </div>
                </div>
                <div class="task-reward">
                    <div class="reward-amount">
                        <img src="https://cdn-icons-png.flaticon.com/512/15208/15208522.png" alt="TON" width="20">
                        <span>${task.reward?.toFixed(5) || '0.00000'} TON</span>
                    </div>
                    <button class="task-btn ${buttonClass}" 
                            data-task-id="${task.id}"
                            data-task-url="${task.url}"
                            data-task-type="${task.type}"
                            data-task-reward="${task.reward}"
                            ${isDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
    }

    setupPromoCodeEvents() {
        const promoBtn = document.getElementById('promo-btn');
        const promoInput = document.getElementById('promo-input');
        
        if (promoBtn) {
            promoBtn.addEventListener('click', () => {
                this.handlePromoCode();
            });
        }
        
        if (promoInput) {
            promoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handlePromoCode();
                }
            });
        }
    }

    async handlePromoCode() {
        const promoInput = document.getElementById('promo-input');
        const promoBtn = document.getElementById('promo-btn');
        
        if (!promoInput || !promoBtn) return;
        
        const code = promoInput.value.trim().toUpperCase();
        if (!code) {
            this.notificationManager.showNotification("Promo Code", "Please enter a promo code", "warning");
            return;
        }
        
        const rateLimitCheck = this.rateLimiter.checkLimit(this.tgUser.id, 'promo_code');
        if (!rateLimitCheck.allowed) {
            this.notificationManager.showNotification(
                "Rate Limit", 
                `Please wait ${rateLimitCheck.remaining} seconds before using another promo code`, 
                "warning"
            );
            return;
        }
        
        const originalText = promoBtn.innerHTML;
        promoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        promoBtn.disabled = true;
        
        try {
            let promoData = null;
            if (this.db) {
                const promoCodesRef = await this.db.ref('config/promoCodes').once('value');
                if (promoCodesRef.exists()) {
                    const promoCodes = promoCodesRef.val();
                    for (const id in promoCodes) {
                        if (promoCodes[id].code === code) {
                            promoData = { id, ...promoCodes[id] };
                            break;
                        }
                    }
                }
            }
            
            if (!promoData) {
                this.notificationManager.showNotification("Promo Code", "Invalid promo code", "error");
                promoBtn.innerHTML = originalText;
                promoBtn.disabled = false;
                return;
            }
            
            if (this.db) {
                const usedRef = await this.db.ref(`usedPromoCodes/${this.tgUser.id}/${promoData.id}`).once('value');
                if (usedRef.exists()) {
                    this.notificationManager.showNotification("Promo Code", "You have already used this code", "error");
                    promoBtn.innerHTML = originalText;
                    promoBtn.disabled = false;
                    return;
                }
            }
            
            let adShown = false;
            if (this.adManager) {
                adShown = await this.adManager.showPromoCodeAd();
            }
            
            if (!adShown) {
                this.notificationManager.showNotification("Ad Required", "Please watch the ad to claim promo", "info");
                promoBtn.innerHTML = originalText;
                promoBtn.disabled = false;
                return;
            }
            
            const reward = this.safeNumber(promoData.reward || 0.01);
            const currentBalance = this.safeNumber(this.userState.balance);
            const newBalance = currentBalance + reward;
            const newTotalPromoCodes = this.safeNumber(this.userState.totalPromoCodes) + 1;
            
            const userUpdates = {
                balance: newBalance,
                totalEarned: this.safeNumber(this.userState.totalEarned) + reward,
                totalPromoCodes: newTotalPromoCodes
            };
            
            if (this.db) {
                await this.db.ref(`users/${this.tgUser.id}`).update(userUpdates);
                
                await this.db.ref(`usedPromoCodes/${this.tgUser.id}/${promoData.id}`).set({
                    code: code,
                    reward: reward,
                    claimedAt: this.getServerTime()
                });
                
                await this.db.ref(`config/promoCodes/${promoData.id}/usedCount`).transaction(current => (current || 0) + 1);
            }
            
            this.userState.balance = newBalance;
            this.userState.totalEarned = this.safeNumber(this.userState.totalEarned) + reward;
            this.userState.totalPromoCodes = newTotalPromoCodes;
            
            this.cache.delete(`user_${this.tgUser.id}`);
            
            this.updateHeader();
            promoInput.value = '';
            
            this.notificationManager.showNotification("Success", `Promo code applied! +${reward.toFixed(3)} TON`, "success");
            
        } catch (error) {
            this.notificationManager.showNotification("Error", "Failed to apply promo code", "error");
        } finally {
            promoBtn.innerHTML = originalText;
            promoBtn.disabled = false;
        }
    }

    setupTaskButtons() {
        const startButtons = document.querySelectorAll('.task-btn.start:not(:disabled)');
        startButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (this.isProcessingTask) return;
                
                const rateLimitCheck = this.rateLimiter.checkLimit(this.tgUser.id, 'task_start');
                if (!rateLimitCheck.allowed) {
                    this.notificationManager.showNotification(
                        "Rate Limit", 
                        `Please wait ${rateLimitCheck.remaining} seconds before starting another task`, 
                        "warning"
                    );
                    return;
                }
                
                const taskId = btn.getAttribute('data-task-id');
                const taskUrl = btn.getAttribute('data-task-url');
                const taskType = btn.getAttribute('data-task-type');
                const taskReward = parseFloat(btn.getAttribute('data-task-reward')) || 0;
                
                if (taskId && taskUrl) {
                    e.preventDefault();
                    await this.taskManager.handleTask(taskId, taskUrl, taskType, taskReward, btn);
                }
            });
        });
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    isAdAvailable(adNumber) {
        if (adNumber === 1) {
            const currentTime = this.getServerTime();
            return this.adTimers.ad1 + this.adCooldown <= currentTime;
        }
        return false;
    }

    getAdTimeLeft(adNumber) {
        if (adNumber === 1) {
            const currentTime = this.getServerTime();
            return Math.max(0, this.adTimers.ad1 + this.adCooldown - currentTime);
        }
        return 0;
    }

    setupAdWatchEvents() {
        const watchAd1Btn = document.getElementById('watch-ad-1-btn');
        
        if (watchAd1Btn) {
            watchAd1Btn.addEventListener('click', async () => {
                await this.watchAd(1);
            });
        }
    }

    async watchAd(adNumber) {
        const currentTime = this.getServerTime();
        const adTimerKey = 'ad1';
        
        if (adNumber !== 1) {
            this.notificationManager.showNotification("Error", "Invalid ad", "error");
            return;
        }
        
        if (this.adTimers[adTimerKey] + this.adCooldown > currentTime) {
            const timeLeft = this.adTimers[adTimerKey] + this.adCooldown - currentTime;
            this.notificationManager.showNotification("Cooldown", `Please wait ${this.formatTime(timeLeft)}`, "info");
            return;
        }
        
        const adBtn = document.getElementById(`watch-ad-${adNumber}-btn`);
        if (adBtn) {
            adBtn.disabled = true;
            adBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
        
        try {
            let adShown = false;
            
            if (this.adManager) {
                adShown = await this.adManager.showWatchAd1();
            }
            
            if (adShown) {
                this.adTimers[adTimerKey] = currentTime;
                await this.saveAdTimers();
                
                const reward = 0.001;
                const currentBalance = this.safeNumber(this.userState.balance);
                const newBalance = currentBalance + reward;
                const newTotalAds = this.safeNumber(this.userState.totalAds) + 1;
                const newWatchedAds = this.safeNumber(this.userState.watchedAds) + 1;
                
                const updates = {
                    balance: newBalance,
                    totalEarned: this.safeNumber(this.userState.totalEarned) + reward,
                    totalTasks: this.safeNumber(this.userState.totalTasks) + 1,
                    totalAds: newTotalAds,
                    watchedAds: newWatchedAds
                };
                
                if (this.db) {
                    await this.db.ref(`users/${this.tgUser.id}`).update(updates);
                }
                
                this.userState.balance = newBalance;
                this.userState.totalEarned = this.safeNumber(this.userState.totalEarned) + reward;
                this.userState.totalTasks = this.safeNumber(this.userState.totalTasks) + 1;
                this.userState.totalAds = newTotalAds;
                this.userState.watchedAds = newWatchedAds;
                
                this.cache.delete(`user_${this.tgUser.id}`);
                
                this.updateHeader();
                this.updateAdButtons();
                
                this.notificationManager.showNotification("Success", `+${reward} TON`, "success");
                
            } else {
                this.notificationManager.showNotification("Error", "Failed to show ad", "error");
                if (adBtn) {
                    adBtn.disabled = false;
                    adBtn.innerHTML = 'WATCH';
                }
            }
            
        } catch (error) {
            this.notificationManager.showNotification("Error", "Failed to watch ad", "error");
            if (adBtn) {
                adBtn.disabled = false;
                adBtn.innerHTML = 'WATCH';
            }
        }
    }

    updateAdButtons() {
        const currentTime = this.getServerTime();
        
        const adBtn = document.getElementById(`watch-ad-1-btn`);
        if (!adBtn) return;
        
        const timeLeft = Math.max(0, this.adTimers.ad1 + this.adCooldown - currentTime);
        
        if (timeLeft > 0) {
            adBtn.disabled = true;
            adBtn.innerHTML = this.formatTime(timeLeft);
            adBtn.classList.remove('available');
            adBtn.classList.add('cooldown');
        } else {
            adBtn.disabled = false;
            adBtn.innerHTML = 'WATCH';
            adBtn.classList.add('available');
            adBtn.classList.remove('cooldown');
        }
    }

    startAdTimers() {
        this.updateAdButtons();
        setInterval(() => this.updateAdButtons(), 1000);
    }

    async renderReferralsPage() {
        const referralsPage = document.getElementById('referrals-page');
        if (!referralsPage) return;
        
        const referralLink = `https://t.me/${this.appConfig.BOT_USERNAME}/ninja?startapp=${this.tgUser.id}`;
        const referrals = this.safeNumber(this.userState.referrals || 0);
        const referralEarnings = this.safeNumber(this.userState.referralEarnings || 0);
        
        const recentReferrals = await this.loadRecentReferralsForDisplay();
        
        referralsPage.innerHTML = `
            <div class="referrals-container">
                <div class="referral-link-box">
                    <p class="link-label">Your referral link:</p>
                    <div class="link-display" id="referral-link-text">${referralLink}</div>
                    <button class="copy-btn" id="copy-referral-link-btn">
                        <i class="far fa-copy"></i> Copy Link
                    </button>
                </div>
                
                <div class="referral-info">
                    <div class="info-card">
                        <div class="info-icon">
                            <i class="fas fa-gift"></i>
                        </div>
                        <div class="info-content">
                            <h4>Get ${this.appConfig.REFERRAL_BONUS_TON} TON</h4>
                            <p>For each verified referral</p>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon">
                            <i class="fas fa-percentage"></i>
                        </div>
                        <div class="info-content">
                            <h4>Earn ${this.appConfig.REFERRAL_PERCENTAGE}% Bonus</h4>
                            <p>From your referrals' earnings</p>
                        </div>
                    </div>
                </div>
                
                <div class="referral-stats-section">
                    <h3><i class="fas fa-chart-bar"></i> Referrals Statistics</h3>
                    <div class="stats-grid-two">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-info">
                                <h4>Total Referrals</h4>
                                <p class="stat-value">${referrals}</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-coins"></i>
                            </div>
                            <div class="stat-info">
                                <h4>Total Earnings</h4>
                                <p class="stat-value">${referralEarnings.toFixed(5)} TON</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="last-referrals-section">
                    <h3><i class="fas fa-history"></i> Recent Referrals</h3>
                    <div class="referrals-list" id="referrals-list">
                        ${recentReferrals.length > 0 ? 
                            recentReferrals.map(referral => this.renderReferralRow(referral)).join('') : 
                            '<div class="no-data"><i class="fas fa-handshake"></i><p>No referrals yet</p><p class="hint">Share your link to earn free TON!</p></div>'
                        }
                    </div>
                </div>
            </div>
        `;
        
        this.setupReferralsPageEvents();
    }

    renderReferralRow(referral) {
        return `
            <div class="referral-row">
                <div class="referral-row-avatar">
                    <img src="${referral.photoUrl}" alt="${referral.firstName}" 
                         oncontextmenu="return false;" 
                         ondragstart="return false;">
                </div>
                <div class="referral-row-info">
                    <p class="referral-row-username">${referral.username}</p>
                </div>
                <div class="referral-row-status ${referral.state}">
                    ${referral.state === 'verified' ? 'COMPLETED' : 'PENDING'}
                </div>
            </div>
        `;
    }

    async loadRecentReferralsForDisplay() {
        try {
            if (!this.db) return [];
            
            const referralsRef = await this.db.ref(`referrals/${this.tgUser.id}`).once('value');
            if (!referralsRef.exists()) return [];
            
            const referralsList = [];
            referralsRef.forEach(child => {
                const referralData = child.val();
                if (referralData && typeof referralData === 'object') {
                    referralsList.push({
                        id: child.key,
                        ...referralData
                    });
                }
            });
            
            return referralsList.sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 10);
            
        } catch (error) {
            return [];
        }
    }

    setupReferralsPageEvents() {
        const copyBtn = document.getElementById('copy-referral-link-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const referralLink = `https://t.me/${this.appConfig.BOT_USERNAME}/ninja?startapp=${this.tgUser.id}`;
                this.copyToClipboard(referralLink);
                
                copyBtn.classList.add('copied');
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = originalText;
                }, 2000);
            });
        }
    }

    async refreshReferralsList() {
        try {
            if (!this.db || !this.tgUser) return;
            
            const referralsRef = await this.db.ref(`referrals/${this.tgUser.id}`).once('value');
            if (!referralsRef.exists()) return;
            
            const referrals = referralsRef.val();
            const verifiedReferrals = [];
            
            for (const referralId in referrals) {
                const referral = referrals[referralId];
                if (referral.state === 'verified' && referral.bonusGiven) {
                    verifiedReferrals.push({
                        id: referralId,
                        ...referral
                    });
                }
            }
            
            this.userState.referrals = verifiedReferrals.length;
            
            if (document.getElementById('referrals-page')?.classList.contains('active')) {
                this.renderReferralsPage();
            }
            
        } catch (error) {
            console.error("Refresh referrals list error:", error);
        }
    }

    renderProfilePage() {
        const profilePage = document.getElementById('profile-page');
        if (!profilePage) return;
        
        const user = this.userState;
        const joinedDate = new Date(user.joinedAt || user.createdAt || this.getServerTime());
        const formattedDate = this.formatDate(joinedDate);
        const formattedTime = this.formatTime24(joinedDate);
        
        const depositOptions = [
            { amount: 0.10, ton: 0.10 },
            { amount: 0.50, ton: 0.50 },
            { amount: 1.00, ton: 1.00 },
            { amount: 5.00, ton: 5.00 }
        ];
        
        const withdrawOptions = [
            { amount: 0.10, ton: 0.10 },
            { amount: 0.50, ton: 0.50 },
            { amount: 1.00, ton: 1.00 },
            { amount: 5.00, ton: 5.00 }
        ];
        
        profilePage.innerHTML = `
            <div class="profile-container">
                <div class="user-profile-card">
                    <div class="profile-header">
                        <div class="profile-avatar-container">
                            <img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/9195/9195920.png'}" 
                                 alt="${user.firstName}" 
                                 class="profile-avatar"
                                 oncontextmenu="return false;" 
                                 ondragstart="return false;">
                        </div>
                        <h2 class="profile-username">${user.firstName}</h2>
                        <div class="profile-userid">ID: ${user.telegramId}</div>
                    </div>
                    
                    <div class="profile-stats">
                        <div class="profile-stat-item">
                            <span class="stat-label">Joined at</span>
                            <div class="stat-value">${formattedDate}</div>
                            <div class="stat-time">${formattedTime}</div>
                        </div>
                        <div class="profile-stat-item">
                            <span class="stat-label">Watched Ads</span>
                            <div class="stat-value">${user.watchedAds || 0}</div>
                        </div>
                        <div class="profile-stat-item">
                            <span class="stat-label">Total Referrals</span>
                            <div class="stat-value">${user.referrals || 0}</div>
                        </div>
                        <div class="profile-stat-item">
                            <span class="stat-label">Total Withdrawals</span>
                            <div class="stat-value">${user.totalWithdrawnTON?.toFixed(2) || '0.00'}</div>
                            <div class="stat-unit">TON</div>
                        </div>
                        <div class="profile-stat-item">
                            <span class="stat-label">Total Earnings</span>
                            <div class="stat-value">${user.totalEarned?.toFixed(2) || '0.00'}</div>
                            <div class="stat-unit">TON</div>
                        </div>
                        <div class="profile-stat-item">
                            <span class="stat-label">Tasks Completed</span>
                            <div class="stat-value">${user.totalTasksCompleted || 0}</div>
                        </div>
                    </div>
                </div>
                
                <div class="deposit-withdraw-section">
                    <h3 class="section-title"><i class="fas fa-wallet"></i> Wallet Actions</h3>
                    
                    <div class="action-buttons">
                        <button id="deposit-btn" class="action-btn">
                            <i class="fas fa-arrow-down"></i> Deposit
                        </button>
                        <button id="withdraw-btn" class="action-btn secondary" 
                                ${user.balance < this.appConfig.MINIMUM_WITHDRAW ? 'disabled' : ''}>
                            <i class="fas fa-arrow-up"></i> Withdraw
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.setupProfilePageEvents();
    }

    setupProfilePageEvents() {
        const depositBtn = document.getElementById('deposit-btn');
        const withdrawBtn = document.getElementById('withdraw-btn');
        
        if (depositBtn) {
            depositBtn.addEventListener('click', () => {
                this.showDepositModal();
            });
        }
        
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', () => {
                this.showWithdrawModal();
            });
        }
    }

    showDepositModal() {
        const modal = document.createElement('div');
        modal.className = 'add-task-modal';
        
        modal.innerHTML = `
            <div class="add-task-content">
                <div class="add-task-header">
                    <h3>Deposit TON</h3>
                    <button class="close-modal">&times;</button>
                </div>
                
                <div class="add-task-body">
                    <div class="form-group">
                        <label><i class="fas fa-coins"></i> Select Amount</label>
                        <div class="option-grid">
                            <div class="option-card" data-amount="0.10">
                                <div class="option-amount">0.10</div>
                                <div class="option-price">TON</div>
                            </div>
                            <div class="option-card" data-amount="0.50">
                                <div class="option-amount">0.50</div>
                                <div class="option-price">TON</div>
                            </div>
                            <div class="option-card" data-amount="1.00">
                                <div class="option-amount">1.00</div>
                                <div class="option-price">TON</div>
                            </div>
                            <div class="option-card" data-amount="5.00">
                                <div class="option-amount">5.00</div>
                                <div class="option-price">TON</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-wallet"></i> Wallet Address</label>
                        <div class="wallet-address-display">
                            <code>UQCMATcdykmpWDSLdI5ob-NScl55FSna3OOVy1l3i_2ICcPZ</code>
                            <button class="copy-small-btn">
                                <i class="far fa-copy"></i>
                            </button>
                        </div>
                        <p class="form-help">Send exact amount to this address</p>
                    </div>
                </div>
                
                <div class="add-task-footer">
                    <button id="confirm-deposit-btn" class="pay-btn" disabled>
                        <i class="fas fa-check-circle"></i> I've Sent
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        this.setupDepositModalEvents(modal);
    }

    setupDepositModalEvents(modal) {
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        const optionCards = modal.querySelectorAll('.option-card');
        optionCards.forEach(card => {
            card.addEventListener('click', () => {
                optionCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                
                const confirmBtn = modal.querySelector('#confirm-deposit-btn');
                if (confirmBtn) confirmBtn.disabled = false;
            });
        });
        
        const copyBtn = modal.querySelector('.copy-small-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const address = 'UQCMATcdykmpWDSLdI5ob-NScl55FSna3OOVy1l3i_2ICcPZ';
                this.copyToClipboard(address);
                
                this.notificationManager.showNotification("Copied", "Wallet address copied", "success");
            });
        }
        
        const confirmBtn = modal.querySelector('#confirm-deposit-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const selectedCard = modal.querySelector('.option-card.selected');
                if (!selectedCard) return;
                
                const amount = parseFloat(selectedCard.dataset.amount);
                
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                confirmBtn.disabled = true;
                
                try {
                    this.notificationManager.showNotification(
                        "Deposit Request", 
                        `Please send ${amount} TON to the wallet address`, 
                        "info"
                    );
                    
                    modal.remove();
                    
                } catch (error) {
                    confirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> I\'ve Sent';
                    confirmBtn.disabled = false;
                    this.notificationManager.showNotification("Error", "Deposit request failed", "error");
                }
            });
        }
    }

    showWithdrawModal() {
        const modal = document.createElement('div');
        modal.className = 'add-task-modal';
        
        modal.innerHTML = `
            <div class="add-task-content">
                <div class="add-task-header">
                    <h3>Withdraw TON</h3>
                    <button class="close-modal">&times;</button>
                </div>
                
                <div class="add-task-body">
                    <div class="form-group">
                        <label><i class="fas fa-coins"></i> Select Amount</label>
                        <div class="option-grid">
                            <div class="option-card" data-amount="0.10">
                                <div class="option-amount">0.10</div>
                                <div class="option-price">TON</div>
                            </div>
                            <div class="option-card" data-amount="0.50">
                                <div class="option-amount">0.50</div>
                                <div class="option-price">TON</div>
                            </div>
                            <div class="option-card" data-amount="1.00">
                                <div class="option-amount">1.00</div>
                                <div class="option-price">TON</div>
                            </div>
                            <div class="option-card" data-amount="5.00">
                                <div class="option-amount">5.00</div>
                                <div class="option-price">TON</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-wallet"></i> Your TON Wallet Address</label>
                        <input type="text" id="withdraw-address" class="form-input" 
                               placeholder="UQ..." required>
                        <p class="form-help">Enter your TON wallet address starting with UQ...</p>
                    </div>
                </div>
                
                <div class="add-task-footer">
                    <button id="confirm-withdraw-btn" class="pay-btn" disabled>
                        <i class="fas fa-paper-plane"></i> Withdraw
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        this.setupWithdrawModalEvents(modal);
    }

    setupWithdrawModalEvents(modal) {
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        const optionCards = modal.querySelectorAll('.option-card');
        const addressInput = modal.querySelector('#withdraw-address');
        const confirmBtn = modal.querySelector('#confirm-withdraw-btn');
        
        optionCards.forEach(card => {
            card.addEventListener('click', () => {
                optionCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                
                this.updateWithdrawButtonState(modal);
            });
        });
        
        if (addressInput) {
            addressInput.addEventListener('input', () => {
                this.updateWithdrawButtonState(modal);
            });
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                await this.processWithdrawal(modal);
            });
        }
        
        this.updateWithdrawButtonState(modal);
    }

    updateWithdrawButtonState(modal) {
        const selectedCard = modal.querySelector('.option-card.selected');
        const addressInput = modal.querySelector('#withdraw-address');
        const confirmBtn = modal.querySelector('#confirm-withdraw-btn');
        
        if (!selectedCard || !addressInput || !confirmBtn) return;
        
        const amount = parseFloat(selectedCard.dataset.amount);
        const address = addressInput.value.trim();
        const userBalance = this.safeNumber(this.userState.balance);
        const minWithdraw = this.appConfig.MINIMUM_WITHDRAW;
        
        confirmBtn.disabled = true;
        
        if (amount >= minWithdraw && amount <= userBalance && address.length > 10) {
            confirmBtn.disabled = false;
        }
    }

    async processWithdrawal(modal) {
        const selectedCard = modal.querySelector('.option-card.selected');
        const addressInput = modal.querySelector('#withdraw-address');
        const confirmBtn = modal.querySelector('#confirm-withdraw-btn');
        
        if (!selectedCard || !addressInput || !confirmBtn) return;
        
        const amount = parseFloat(selectedCard.dataset.amount);
        const address = addressInput.value.trim();
        const userBalance = this.safeNumber(this.userState.balance);
        const minWithdraw = this.appConfig.MINIMUM_WITHDRAW;
        
        if (amount < minWithdraw) {
            this.notificationManager.showNotification("Error", `Minimum withdrawal is ${minWithdraw} TON`, "error");
            return;
        }
        
        if (amount > userBalance) {
            this.notificationManager.showNotification("Error", "Insufficient balance", "error");
            return;
        }
        
        if (address.length < 10) {
            this.notificationManager.showNotification("Error", "Please enter a valid TON wallet address", "error");
            return;
        }
        
        const rateLimitCheck = this.rateLimiter.checkLimit(this.tgUser.id, 'withdrawal');
        if (!rateLimitCheck.allowed) {
            const hours = Math.floor(rateLimitCheck.remaining / 3600);
            const minutes = Math.floor((rateLimitCheck.remaining % 3600) / 60);
            let timeMessage = '';
            if (hours > 0) {
                timeMessage = `${hours} hour${hours > 1 ? 's' : ''}`;
                if (minutes > 0) {
                    timeMessage += ` and ${minutes} minute${minutes > 1 ? 's' : ''}`;
                }
            } else {
                timeMessage = `${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
            this.notificationManager.showNotification(
                "Withdrawal Limit!", 
                `You can withdraw only one time every day. Please wait ${timeMessage}.`, 
                "error"
            );
            return;
        }
        
        if (this.userState.lastWithdrawalDate) {
            const lastWithdrawal = new Date(this.userState.lastWithdrawalDate);
            const now = new Date(this.getServerTime());
            const diffMs = now - lastWithdrawal;
            const diffHours = diffMs / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                const remainingHours = 24 - diffHours;
                this.notificationManager.showNotification(
                    "Withdrawal Limit!",
                    `You can withdrawal only one time every day. Please wait ${Math.ceil(remainingHours)} hours.`,
                    "error"
                );
                return;
            }
        }
        
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        confirmBtn.disabled = true;
        
        try {
            if (this.adManager) {
                const adShown = await this.adManager.showWithdrawalAd();
                if (!adShown) {
                    this.notificationManager.showNotification("Ad Required", "Please watch the ad to process withdrawal", "info");
                    confirmBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Withdraw';
                    confirmBtn.disabled = false;
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const newBalance = userBalance - amount;
            const currentTime = this.getServerTime();
            const newTotalWithdrawnTON = this.safeNumber(this.userState.totalWithdrawnTON) + amount;
            
            if (this.db) {
                await this.db.ref(`users/${this.tgUser.id}`).update({
                    balance: newBalance,
                    totalWithdrawals: this.safeNumber(this.userState.totalWithdrawals) + 1,
                    totalWithdrawnTON: newTotalWithdrawnTON,
                    lastWithdrawalDate: currentTime
                });
                
                const requestData = {
                    userId: this.tgUser.id,
                    userName: this.userState.firstName,
                    username: this.userState.username,
                    walletAddress: address,
                    amount: amount,
                    status: 'pending',
                    createdAt: currentTime
                };
                
                await this.db.ref('withdrawals/pending').push(requestData);
            }
            
            this.userState.balance = newBalance;
            this.userState.totalWithdrawals = this.safeNumber(this.userState.totalWithdrawals) + 1;
            this.userState.totalWithdrawnTON = newTotalWithdrawnTON;
            this.userState.lastWithdrawalDate = currentTime;
            
            this.cache.delete(`user_${this.tgUser.id}`);
            
            await this.updateAppStats('totalWithdrawals', 1);
            await this.updateAppStats('totalPayments', amount);
            
            await this.loadHistoryData();
            
            modal.remove();
            
            this.updateHeader();
            this.renderProfilePage();
            
            this.notificationManager.showNotification("Success", "Withdrawal request submitted!", "success");
            
        } catch (error) {
            console.error("Withdrawal error:", error);
            this.notificationManager.showNotification("Error", "Failed to process withdrawal", "error");
            confirmBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Withdraw';
            confirmBtn.disabled = false;
        }
    }

    copyToClipboard(text) {
        if (!text || this.isCopying) return;
        
        this.isCopying = true;
        
        navigator.clipboard.writeText(text).then(() => {
            this.notificationManager.showNotification("Copied", "Text copied to clipboard", "success");
            setTimeout(() => {
                this.isCopying = false;
            }, 1000);
        }).catch(() => {
            this.notificationManager.showNotification("Error", "Failed to copy text", "error");
            setTimeout(() => {
                this.isCopying = false;
            }, 1000);
        });
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    formatTime24(timestamp) {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    setupEventListeners() {
        const telegramIdElement = document.getElementById('user-telegram-id');
        if (telegramIdElement) {
            telegramIdElement.addEventListener('click', () => {
                if (this.tgUser?.id) {
                    this.copyToClipboard(this.tgUser.id.toString());
                }
            });
        }
    }

    generateReferralCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 7; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `TORN${code}`;
    }

    safeNumber(value) {
        if (value === null || value === undefined) return 0;
        const num = Number(value);
        return isNaN(num) ? 0 : num;
    }

    getShortName(name) {
        if (!name) return 'User';
        return name;
    }

    truncateName(name, maxLength = 20) {
        if (!name) return 'User';
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength) + '...';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!window.Telegram || !window.Telegram.WebApp) {
        document.body.innerHTML = `
            <div class="error-container">
                <div class="error-content">
                    <div class="error-icon">
                        <i class="fab fa-telegram"></i>
                    </div>
                    <h2>Tornado TON</h2>
                    <p>Please open from Telegram Mini App</p>
                </div>
            </div>
        `;
        return;
    }
    
    window.app = new TornadoApp();
    
    setTimeout(() => {
        if (window.app && typeof window.app.initialize === 'function') {
            window.app.initialize();
        }
    }, 300);
});
