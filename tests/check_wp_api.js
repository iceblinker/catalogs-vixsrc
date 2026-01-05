const fetch = require('node-fetch');

async function check() {
    const url = 'https://eurostreamings.pics/wp-json/wp/v2/posts?per_page=1';
    console.log(`Checking ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const json = await res.json();
            console.log('JSON:', JSON.stringify(json[0]?.title, null, 2));
        } else {
            console.log('Text:', await res.text());
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

check();
