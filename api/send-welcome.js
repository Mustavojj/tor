export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const userId = req.headers['x-telegram-user'];
        const telegramHash = req.headers['x-telegram-auth'];
        
        if (!userId || !telegramHash) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { chat_id, text, photo, buttons } = req.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        
        if (!BOT_TOKEN) {
            return res.status(500).json({ error: 'Bot token not configured' });
        }
        
        const inlineKeyboard = {
            inline_keyboard: buttons.map(btn => [{
                text: btn.text,
                url: btn.url
            }])
        };
        
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chat_id,
                photo: photo,
                caption: text,
                reply_markup: inlineKeyboard
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            res.status(200).json({ success: true, message: 'Welcome message sent' });
        } else {
            res.status(400).json({ error: 'Failed to send message', details: data });
        }
        
    } catch (error) {
        console.error('Send welcome message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
