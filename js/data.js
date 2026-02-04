export const APP_CONFIG = {
    APP_NAME: "Tornado",
    BOT_USERNAME: "Tornado_Rbot",
    MINIMUM_WITHDRAW: 0.10,
    REFERRAL_BONUS_TON: 0.001,
    REFERRAL_PERCENTAGE: 20,
    REFERRAL_BONUS_TASKS: 0,
    TASK_REWARD_BONUS: 0,
    MAX_DAILY_ADS: 999999,
    AD_COOLDOWN: 600000,
    WATCH_AD_REWARD: 0.001, 
    REQUIRED_ADS_FOR_WITHDRAWAL: 10, 
    DEFAULT_USER_AVATAR: "https://cdn-icons-png.flaticon.com/512/9195/9195920.png",
    BOT_AVATAR: "https://i.ibb.co/GvWFRrnp/ninja.png",
    WELCOME_TASKS: [
        {
            name: "Join Official Channel",
            url: "https://t.me/TORNADO_CHNL",
            channel: "@TORNADO_CHNL"
        },
        {
            name: "Join Community Chat",
            url: "https://t.me/NEJARS",
            channel: "@NEJARS"
        },
        {
            name: "Join Money Hub",
            url: "https://t.me/MONEYHUB9_69",
            channel: "@MONEYHUB9_69"
        },
        {
            name: "Join Crypto Al",
            url: "https://t.me/Crypto_al2",
            channel: "@Crypto_al2"
        }
    ],
    
    WELCOME_MESSAGE: {
        text: "⚡ Welcome to Tornado!\n\n🚀 Start your journey with us!",
        buttons: [
            {
                text: "Start App 💎",
                url: "https://t.me/Tornado_Rbot/start"
            },
            {
                text: "Get News 📰",
                url: "https://t.me/TORNADO_CHNL"
            }
        ]
    }
};

export const CORE_CONFIG = {
    CACHE_TTL: 300000,
    RATE_LIMITS: {
        'task_start': { limit: 1, window: 3000 },
        'withdrawal': { limit: 1, window: 86400000 },
        'ad_reward': { limit: 10, window: 300000 },
        'promo_code': { limit: 5, window: 300000 }
    },
    NOTIFICATION_COOLDOWN: 2000,
    MAX_NOTIFICATION_QUEUE: 3,
    AD_COOLDOWN: 600000,
    INITIAL_AD_DELAY: 30000,
    INTERVAL_AD_DELAY: 150000
};

export const FEATURES_CONFIG = {
    TASK_VERIFICATION_DELAY: 10,
    REFERRAL_BONUS_TON: 0.001,
    REFERRAL_PERCENTAGE: 20,
    REFERRALS_PER_PAGE: 10,
    PARTNER_TASK_REWARD: 0.001,
    SOCIAL_TASK_REWARD: 0.0005
};

export const THEME_CONFIG = {
    LIGHT_MODE: {
        background: "#ffffff",
        cardBg: "#f8fafc",
        cardBgSolid: "#f1f5f9",
        textPrimary: "#1e293b",
        textSecondary: "#475569",
        textLight: "#64748b",
        primaryColor: "#3b82f6",
        secondaryColor: "#1e40af",
        accentColor: "#60a5fa"
    },
    DARK_MODE: {
        background: "#000000",
        cardBg: "rgba(17, 17, 17, 0.7)",
        cardBgSolid: "#111111",
        textPrimary: "#f1f5f9",
        textSecondary: "#cbd5e1",
        textLight: "#94a3b8",
        primaryColor: "#1e3a8a",
        secondaryColor: "#1e40af",
        accentColor: "#3b82f6"
    }
};
