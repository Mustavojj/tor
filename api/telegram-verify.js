const crypto = require('crypto');

function verifyTelegramInitData(initData, botToken) {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        params.delete('hash');
        
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const dataCheckString = [...params.entries()]
            .sort()
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        
        const calculatedHash = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        
        return calculatedHash === hash;
    } catch (error) {
        console.error('Telegram verification error:', error);
        return false;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { initData } = req.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        
        if (!initData || !BOT_TOKEN) {
            return res.status(400).json({ error: 'Missing parameters' });
        }
        
        const isValid = verifyTelegramInitData(initData, BOT_TOKEN);
        
        if (isValid) {
            res.status(200).json({ valid: true });
        } else {
            res.status(401).json({ valid: false, error: 'Invalid Telegram data' });
        }
        
    } catch (error) {
        console.error('Verification handler error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
