export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || '';
        
        const blockedAgents = [
            'python', 'curl', 'wget', 'postman', 'insomnia',
            'bot', 'crawler', 'spider', 'scraper',
            'sqlmap', 'nmap', 'burp', 'hydra',
            'nikto', 'gobuster', 'dirb', 'ffuf'
        ];
        
        const isBlocked = blockedAgents.some(agent => 
            userAgent.toLowerCase().includes(agent.toLowerCase())
        );
        
        if (isBlocked) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > 1000) {
            return res.status(413).json({ error: 'Payload too large' });
        }
        
        const telegramUserId = req.headers['x-telegram-user'];
        const telegramAuth = req.headers['x-telegram-auth'];
        
        if (!telegramUserId || !telegramAuth) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const requestKey = `firebase_${userIp}`;
        const now = Date.now();
        
        if (!global.firebaseRequestStore) global.firebaseRequestStore = {};
        if (!global.firebaseRequestStore[requestKey]) global.firebaseRequestStore[requestKey] = [];
        
        global.firebaseRequestStore[requestKey] = global.firebaseRequestStore[requestKey].filter(
            time => now - time < 300000
        );
        
        if (global.firebaseRequestStore[requestKey].length >= 5) {
            return res.status(429).json({ error: 'Too many requests' });
        }
        
        global.firebaseRequestStore[requestKey].push(now);
        
        const firebaseConfig = {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            databaseURL: process.env.FIREBASE_DATABASE_URL,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            measurementId: process.env.FIREBASE_MEASUREMENT_ID
        };
        
        res.status(200).json(firebaseConfig);
        
    } catch (error) {
        res.status(200).json({
            apiKey: "AIzaSyDefaultKey123",
            authDomain: "ninja-dbdb.firebaseapp.com",
            databaseURL: "https://ninja-dbdb-default-rtdb.firebaseio.com",
            projectId: "ninja-dbdb",
            storageBucket: "ninja-dbdb.firebasestorage.app",
            messagingSenderId: "964108797706",
            appId: "1:964108797706:web:95e6bccba0934f7bdbdcf3",
            measurementId: "G-2EV8GCX8JK"
        });
    }
            }
