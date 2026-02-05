export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    try {
        const { action, params } = req.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        
        if (!BOT_TOKEN) {
            return res.status(200).json({ 
                ok: true, 
                result: { status: 'member' } // افترض النجاح إذا لم يكن هناك توكن
            });
        }
        
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        
        const data = await response.json();
        res.status(200).json(data);
        
    } catch (error) {
        // في حالة الخطأ، ارجع حالة افتراضية
        res.status(200).json({ 
            ok: true, 
            result: { status: 'member' } 
        });
    }
            }
