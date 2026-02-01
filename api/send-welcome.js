export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    try {
        const userId = req.headers['x-telegram-user'];
        const telegramHash = req.headers['x-telegram-auth'];
        
        if (!userId || !telegramHash) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { user_id, first_name, photo_url, message } = req.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        
        const welcomeMessage = `⚡ Welcome to Tornado!\n\nStart your journey with us!`;
        
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user_id,
                text: welcomeMessage,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Start App 💎",
                                url: "https://t.me/Tornado_Rbot/start"
                            },
                            {
                                text: "Get News 📰",
                                url: "https://t.me/Tornado_Channel"
                            }
                        ]
                    ]
                }
            })
        });
        
        const data = await response.json();
        
        if (data.ok && photo_url && photo_url !== 'https://cdn-icons-png.flaticon.com/512/9195/9195920.png') {
            try {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: user_id,
                        photo: photo_url,
                        caption: `Welcome ${first_name}! 🎉`
                    })
                });
            } catch (photoError) {
                console.log("Photo send error:", photoError);
            }
        }
        
        res.status(200).json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
}
