export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const encryptedConfig = "eyJhcGlLZXkiOiJBSXphU3lFeGFtcGxlMTIzIiwiYXV0aERvbWFpbiI6InRvcm5hZG8tYXBwLmZpcmViYXNlYXBwLmNvbSIsImRhdGFiYXNlVVJMIjoiaHR0cHM6Ly90b3JuYWRvLWFwcC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20iLCJwcm9qZWN0SWQiOiJ0b3JuYWRvLWFwcCIsInN0b3JhZ2VCdWNrZXQiOiJ0b3JuYWRvLWFwcC5hc3Bwb3QuY29tIiwibWVzc2FnaW5nU2VuZGVySWQiOiIxMjM0NTY3ODkwIiwiYXBwSWQiOiIxOjEyMzQ1Njc4OTA6d2ViOmFiY2RlZjEyMzQ1NiIsIm1lYXN1cmVtZW50SWQiOiJHLUVYQU1QTEUxMjMifQ==";
        
        res.status(200).json({
            encrypted: encryptedConfig
        });
        
    } catch (error) {
        res.status(200).json({
            encrypted: "eyJhcGlLZXkiOiJBSXphU3lEZWZhdWx0S2V5MTIzIiwiYXV0aERvbWFpbiI6InRvcm5hZG8tZGVmYXVsdC5maXJlYmFzZWFwcC5jb20iLCJkYXRhYmFzZVVSTCI6Imh0dHBzOi8vdG9ybmFkby1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20iLCJwcm9qZWN0SWQiOiJ0b3JuYWRvLWRlZmF1bHQiLCJzdG9yYWdlQnVja2V0IjoidG9ybmFkby1kZWZhdWx0LmFwcHNwb3QuY29tIiwibWVzc2FnaW5nU2VuZGVySWQiOiI5ODc2NTQzMjEwOTgiLCJhcHBJZCI6IjE6OTg3NjU0MzIxMDk4OndlYjpkZWZhdWx0MTIzNDU2Nzg5MCIsIm1lYXN1cmVtZW50SWQiOiJHLURFRkFVTFQxMjMifQ=="
        });
    }
}
