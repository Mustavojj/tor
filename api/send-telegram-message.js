export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { userId, firstName, photoUrl, messageConfig } = req.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        
        if (!userId || !BOT_TOKEN) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const messageText = `${messageConfig.text}\n\nWelcome ${firstName}!`;
        
        const buttons = messageConfig.buttons.map(button => ({
            text: button.text,
            url: button.url
        }));
        
        const keyboard = {
            inline_keyboard: [buttons]
        };
        
        const messageData = {
            chat_id: userId,
            text: messageText,
            reply_markup: JSON.stringify(keyboard)
        };
        
        if (photoUrl) {
            messageData.photo = photoUrl;
            messageData.caption = messageText;
            
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageData)
            });
            
            const result = await response.json();
            res.status(200).json({ success: result.ok });
        } else {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageData)
            });
            
            const result = await response.json();
            res.status(200).json({ success: result.ok });
        }
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
}
