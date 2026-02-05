export const APP_CONFIG = {
    APP_NAME: "Tornado",
    BOT_USERNAME: "Tornado_Rbot",
    BOT_TOKEN_ENCRYPTED: "7881276129:AAFS9EjbD0V3LlgY3YNeTcjbXOHj6_-L-zU",
    MINIMUM_WITHDRAW: 0.10,
    REFERRAL_BONUS_TON: 0.01,
    REFERRAL_PERCENTAGE: 10,
    REFERRAL_BONUS_TASKS: 0,
    TASK_REWARD_BONUS: 0,
    MAX_DAILY_ADS: 999999,
    AD_COOLDOWN: 60000,
    WATCH_AD_REWARD: 0.001,
    REQUIRED_ADS_FOR_WITHDRAWAL: 10,
    DEFAULT_USER_AVATAR: "https://i.ibb.co/gM8hnfwm/TORNADO-PIC.png",
    BOT_AVATAR: "https://i.ibb.co/GvWFRrnp/ninja.png",
    WELCOME_TASKS: [
        {
            name: "Join Official Channel",
            url: "https://t.me/TORNADO_CHNL",
            channel: "@TORNADO_CHNL"
        },
        {
            name: "Join Official Chat",
            url: "https://t.me/NEJARS",
            channel: "@NEJARS"
        }
    ]
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
    AD_COOLDOWN: 60000,
    INITIAL_AD_DELAY: 30000,
    INTERVAL_AD_DELAY: 150000
};

export const FEATURES_CONFIG = {
    TASK_VERIFICATION_DELAY: 10,
    REFERRAL_BONUS_TON: 0.01,
    REFERRAL_PERCENTAGE: 10,
    REFERRALS_PER_PAGE: 10,
    PARTNER_TASK_REWARD: 0.001,
    SOCIAL_TASK_REWARD: 0.0005
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
        background: "#000000",
        cardBg: "rgba(17, 17, 17, 0.7)",
        cardBgSolid: "#111111",
        textPrimary: "#f1f5f9",
        textSecondary: "#cbd5e1",
        textLight: "#94a3b8",
        primaryColor: "#94a3b8",
        secondaryColor: "#cbd5e1",
        accentColor: "#64748b"
    }
};
