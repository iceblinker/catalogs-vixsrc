const fetch = require('node-fetch');

async function testTorrentGalaxy() {
    console.log('\n=== Testing TorrentGalaxy API ===');
    const query = '1080p';
    const url = `https://torrentgalaxy.space/get-posts/keywords:${encodeURIComponent(query)}:format:json`;

    try {
        console.log(`Fetching: ${url}`);
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            console.log(`❌ Failed: HTTP ${res.status}`);
            const text = await res.text();
            console.log('Response:', text.substring(0, 200));
            return;
        }

        const text = await res.text();
        // console.log('Raw:', text.substring(0, 200));
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.log('❌ JSON Parse Failed');
            console.log('Raw Response Body:', text.substring(0, 500));
            return;
        }

        console.log(`✅ Success! Found ${data.results ? data.results.length : 0} results.`);
        if (data.results && data.results.length === 0) {
            console.log('Raw Response Body:', text.substring(0, 500));
        }
        if (data.results && data.results.length > 0) {
            console.log('Sample:', data.results[0]);
        }
    } catch (e) {
        console.log(`❌ Error: ${e.message}`);
    }
}

testTorrentGalaxy();
