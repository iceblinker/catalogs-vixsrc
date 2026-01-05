const animeunity = require('../services/streams/scrapers/animeunity');

async function test() {
    const queries = [
        { q: 'Train Dreams', type: 'movie' }
    ];

    for (const { q, type, episode } of queries) {
        console.log(`\n--- Testing ${q} (${type}) ---`);
        try {
            const results = await animeunity.searchAndResolve(q, type, 1, episode || 1);
            console.log(`Found ${results.length} streams`);
            results.forEach(s => {
                console.log(`- ${s.title} (${s.url})`);
            });
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}

test();
