const fetch = require('node-fetch');

async function inspectContent() {
    // 1. Inspect Guardahd
    console.log('\n--- Guardahd Content ---');
    try {
        const res = await fetch('https://guardahd.stream', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const text = await res.text();
        console.log(text);
    } catch (e) {
        console.error(e.message);
    }

    // 2. Inspect ToonItalia (xyz)
    console.log('\n--- ToonItalia (xyz) Content Snippet ---');
    try {
        const res = await fetch('https://toonitalia.xyz', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const text = await res.text();
        console.log(text.substring(0, 1000)); // First 1000 chars

        // Check for search form
        if (text.includes('search') || text.includes('cerca')) {
            console.log('✅ Search form found.');
        } else {
            console.warn('⚠️ No search form found in snippet.');
        }
    } catch (e) {
        console.error(e.message);
    }
}

inspectContent();
