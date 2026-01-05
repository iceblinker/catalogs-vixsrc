const fetch = require('node-fetch');

async function testZilean() {
    const baseUrl = 'https://zilean.elfhosted.com';
    const query = 'Deadpool';
    const url = `${baseUrl}/dmm/filtered?query=${encodeURIComponent(query)}`;

    console.log(`Testing Zilean API: ${url}`);

    try {
        const response = await fetch(url);
        console.log(`Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            console.log('Response data type:', typeof data);
            if (Array.isArray(data)) {
                console.log(`Found ${data.length} results.`);
                if (data.length > 0) {
                    console.log('Sample item:', JSON.stringify(data[0], null, 2));
                }
            } else {
                console.log('Response:', JSON.stringify(data, null, 2));
            }
        } else {
            const text = await response.text();
            console.log('Error body:', text);
        }
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}

testZilean();
