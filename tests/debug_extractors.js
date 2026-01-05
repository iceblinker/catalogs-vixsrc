const { extractFromUrl } = require('../services/streams/utils/extractor');

async function test() {
    const urls = [
        'https://mixdrop.co/f/testvideo',
        'https://streamtape.com/e/testvideo',
        'https://dood.to/e/testvideo',
        'https://vixcloud.co/embed/testvideo'
    ];

    for (const url of urls) {
        console.log(`\n--- Testing ${url} ---`);
        const result = await extractFromUrl(url);
        console.log('Result:', JSON.stringify(result, null, 2));
    }
}

test();
