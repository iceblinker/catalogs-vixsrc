const fetch = require('node-fetch');

const domains = [
    'https://guardahd.stream',
    'https://toonitalia.org',
    'https://toonitalia.xyz',
    'https://toonitalia.pro'
];

async function checkDomains() {
    console.log('Checking domains...');
    for (const domain of domains) {
        try {
            console.log(`\nFetching ${domain}...`);
            const res = await fetch(domain, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });
            console.log(`Status: ${res.status} ${res.statusText}`);
            console.log(`Content-Type: ${res.headers.get('content-type')}`);
            const text = await res.text();
            console.log(`Body Length: ${text.length}`);
            if (text.includes('Cloudflare') || text.includes('Just a moment')) {
                console.warn('⚠️  Likely Cloudflare Protected');
            }
        } catch (e) {
            console.error(`❌ Error: ${e.message}`);
        }
    }
}

checkDomains();
