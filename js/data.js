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
    WELCOME_TASKS: [
        {
            name: "Join Official Channel",
            url: "https://t.me/Tornado_Channel",
            channel: "@Tornado_Channel"
        },
        {
            name: "Join Community Chat",
            url: "https://t.me/Tornado_Chat",
            channel: "@Tornado_Chat"
        }
    ],
    TASK_PRICES: {
        100: 0.100,
        250: 0.250,
        500: 0.500,
        1000: 1.000,
        2500: 2.500,
        5000: 5.000
    },
    PRICE_PER_1000: 1.00,
    WELCOME_MESSAGE: {
        text: "⚡ Welcome to Tornado!\n\nStart your journey with us!",
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
    DEPOSIT_ADDRESS: "UQCMATcdykmpWDSLdI5ob-NScl55FSna3OOVy1l3i_2ICcPZ",
    MINIMUM_DEPOSIT: 0.10
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
