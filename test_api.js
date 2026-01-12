
const fetch = require('node-fetch'); // NOTE: Assuming node-fetch is available or using built-in fetch in Node 18+

// API Configuration
const API_URL = 'https://getlate.dev/api/v1';
const API_KEY = 'sk_b00cf1517e5928515f6a40574be37b0d59cb6d2abef68fb57492b40a86758590';
const FACEBOOK_ID = '69646c3f4207e06f4ca84d2e';

async function testPost() {
    console.log('🚀 Sending test post to API...');

    try {
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: 'Hello from Antigravity Test! 🚀 ' + new Date().toISOString(),
                platforms: [
                    { platform: 'facebook', accountId: FACEBOOK_ID }
                ],
                publishNow: true
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${text}`);
        }

        const data = await response.json();
        console.log('✅ Success! Post response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('❌ Stats Test Failed:', error.message);
    }
}

testPost();
