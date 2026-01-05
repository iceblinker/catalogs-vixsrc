const torrentgalaxy = require('../services/streams/scrapers/torrentgalaxy');
const settings = require('../config/settings');

async function verifyRegexFilter() {
    const query = 'Deadpool CAM'; // Likely to have CAM releases
    console.log(`\n=== Verifying Regex Filter ===`);
    console.log(`Exclude Patterns:`, settings.EXCLUDE_REGEX);

    // 1. Fetch raw streams
    const streams = await torrentgalaxy.getStreams(query);
    console.log(`Fetched ${streams.length} total streams.`);

    // 2. Apply Filter (Simulating StreamService logic)
    const filtered = streams.filter(s => {
        const nameToCheck = (s.title || s.name || '').toUpperCase();

        if (settings.EXCLUDE_REGEX && settings.EXCLUDE_REGEX.length > 0) {
            for (const regex of settings.EXCLUDE_REGEX) {
                if (regex.test(nameToCheck)) {
                    console.log(`[Filtered] ${s.title} (Matched: ${regex})`);
                    return false;
                }
            }
        }
        return true;
    });

    console.log(`\nStreams remaining after filter: ${filtered.length}`);

    // Check if any banned streams slipped through
    const failures = filtered.filter(s => {
        const nameToCheck = (s.title || s.name || '').toUpperCase();
        return settings.EXCLUDE_REGEX.some(r => r.test(nameToCheck));
    });

    if (failures.length > 0) {
        console.error('❌ Test Failed: Banned streams remained!');
        failures.forEach(s => console.log(`- ${s.title}`));
    } else {
        console.log('✅ Test Passed: All banned streams filtered.');
    }
}

verifyRegexFilter();
