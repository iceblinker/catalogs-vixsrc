require('dotenv').config();
const fetch = require('node-fetch');

async function testRD() {
    const key = process.env.REALDEBRID_API_KEY;
    console.log(`Testing RealDebrid Key: ${key ? key.substring(0, 5) + '...' : 'MISSING'}`);

    if (!key) {
        console.error('No API Key found in .env');
        return;
    }

    // Test 1: User Info
    console.log('\n--- Test 1: /user ---');
    try {
        const response = await fetch('https://api.real-debrid.com/rest/1.0/user', {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        console.log(`Status: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            console.error('Body:', await response.text());
        } else {
            const data = await response.json();
            console.log(`User: ${data.username}, Premium: ${data.premium} days`);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }

    // Test 2: Instant Availability (Single Hash)
    console.log('\n--- Test 2: /torrents/instantAvailability (Single Hash) ---');
    const hash = '2C6256874649CBC8BBD6911E2FE91180AF0801F6'; // From logs
    try {
        const url = `https://api.real-debrid.com/rest/1.0/torrents/instantAvailability/${hash}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        console.log(`URL: ${url}`);
        console.log(`Status: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            console.error('Body:', await response.text());
        } else {
            const data = await response.json();
            console.log('Response:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testRD();
