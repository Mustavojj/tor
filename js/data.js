export const APP_CONFIG = {
    APP_NAME: "Tornado",
    BOT_USERNAME: "Tornado_Rbot",
    MINIMUM_WITHDRAW: 0.20,
    REFERRAL_BONUS_TON: 0.02,
    REFERRAL_PERCENTAGE: 0,
    REFERRAL_BONUS_TASKS: 0,
    TASK_REWARD_BONUS: 0,
    MAX_DAILY_ADS: 50,
    AD_COOLDOWN: 180000,
    WATCH_AD_REWARD: 0.0005,
    REQUIRED_ADS_FOR_WITHDRAWAL: 5,
    REQUIRED_TASKS_FOR_WITHDRAWAL: 10,
    REQUIRED_REFERRALS_FOR_WITHDRAWAL: 1,
    DEFAULT_USER_AVATAR: "https://i.ibb.co/gM8hnfwm/TORNADO-PIC.png",
    BOT_AVATAR: "https://i.ibb.co/gM8hnfwm/TORNADO-PIC.png",
    WALLET_VALIDATION: {
        MIN_LENGTH: 32,
        PREFIX: "UQ",
        PASSWORD_MIN_LENGTH: 8,
        PASSWORD_MAX_LENGTH: 16,
        REQUIRE_CAPITAL: true,
        REQUIRE_SYMBOL: true,
        REQUIRE_NUMBER: true
    },
    WELCOME_TASKS: [
        {
            name: "Join Official Channel",
            url: "https://t.me/TORNADO_CHNL",
            channel: "@TORNADO_CHNL"
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
    ]
};

export const CORE_CONFIG = {
    CACHE_TTL: 300000,
    RATE_LIMITS: {
        'task_start': { limit: 1, window: 3000 },
        'withdrawal': { limit: 1, window: 1000 },
        'ad_reward': { limit: 10, window: 300000 },
        'promo_code': { limit: 5, window: 300000 }
    },
    NOTIFICATION_COOLDOWN: 2000,
    MAX_NOTIFICATION_QUEUE: 3,
    AD_COOLDOWN: 180000,
    INITIAL_AD_DELAY: 30000,
    INTERVAL_AD_DELAY: 150000
};

export const FEATURES_CONFIG = {
    TASK_VERIFICATION_DELAY: 10,
    REFERRAL_BONUS_TON: 0.02,
    REFERRAL_PERCENTAGE: 0,
    REFERRALS_PER_PAGE: 10,
    PARTNER_TASK_REWARD: 0.001,
    SOCIAL_TASK_REWARD: 0.001
};

export const THEME_CONFIG = {
    LIGHT_MODE: {
        background: "#f8fafc",
        cardBg: "#f1f5f9",
        cardBgSolid: "#e2e8f0",
        textPrimary: "#334155",
        textSecondary: "#475569",
        textLight: "#64748b",
        primaryColor: "#94a3b8",
        secondaryColor: "#cbd5e1",
        accentColor: "#64748b"
    },
    DARK_MODE: {
        background: "#0f172a",
        cardBg: "rgba(30, 41, 59, 0.8)",
        cardBgSolid: "#1e293b",
        textPrimary: "#f1f5f9",
        textSecondary: "#cbd5e1",
        textLight: "#94a3b8",
        primaryColor: "#60a5fa",
        secondaryColor: "#93c5fd",
        accentColor: "#3b82f6"
    }
};
