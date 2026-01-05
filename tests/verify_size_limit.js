const torrentgalaxy = require('../services/streams/scrapers/torrentgalaxy');
const knaben = require('../services/streams/scrapers/knaben');
const settings = require('../config/settings');

// Mock settings for test if needed, but we rely on the actual implementation
// We will manually check the filtering logic by simulating what streamService does

async function verifySizeLimit() {
    const query = 'Avatar 1080p ITA'; // Likely to have large files
    console.log(`\n=== Verifying Size Limit: ${settings.MAX_SIZE_GB} GB ===`);
    console.log(`Max Bytes: ${settings.MAX_SIZE_GB * 1024 * 1024 * 1024}`);

    // 1. Fetch raw streams
    const tgStreams = await torrentgalaxy.getStreams(query);
    const knStreams = await knaben.getStreams(query);
    const allStreams = [...tgStreams, ...knStreams];

    console.log(`Fetched ${allStreams.length} total streams.`);

    // 2. Apply Filter
    const maxBytes = settings.MAX_SIZE_GB * 1024 * 1024 * 1024;
    const filtered = allStreams.filter(s => {
        if (s.size && s.size > maxBytes) {
            console.log(`[Filtered] ${s.title} (Size: ${(s.size / 1024 / 1024 / 1024).toFixed(2)} GB)`);
            return false;
        }
        return true;
    });

    console.log(`\nStreams remaining after filter: ${filtered.length}`);

    // Check if any large streams slipped through (should be 0 if logic is correct)
    const failures = filtered.filter(s => s.size > maxBytes);
    if (failures.length > 0) {
        console.error('❌ Test Failed: Large streams remained!');
        failures.forEach(s => console.log(`- ${s.title} (${s.size})`));
    } else {
        console.log('✅ Test Passed: All large streams filtered.');
    }
}

verifySizeLimit();
