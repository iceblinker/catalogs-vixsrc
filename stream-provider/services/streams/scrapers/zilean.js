const fetch = require('node-fetch');
const settings = require('../../../config/settings');

async function getStreams(query) {
    // Zilean is a DMM hashlist scraper.
    // It returns torrents that are indexed in Debrid Media Manager.
    const baseUrl = 'https://zilean.elfhosted.com';
    const url = `${baseUrl}/dmm/filtered?query=${encodeURIComponent(query)}`;

    console.log(`[Zilean] Searching for: ${query}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[Zilean] Error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('[Zilean] Unexpected response format');
            return [];
        }

        console.log(`[Zilean] Found ${data.length} results.`);

        return data.map(item => {
            return {
                name: `Zilean\n${item.quality || 'Unknown'}`,
                title: item.raw_title || item.filename,
                infoHash: item.info_hash,
                size: parseInt(item.size),
                seeders: 0, // Zilean doesn't provide seeders, but DMM implies cached/available
                source: 'Zilean',
                behaviorHints: {
                    bingeGroup: `zilean-${item.info_hash}`
                }
            };
        });

    } catch (e) {
        console.error(`[Zilean] Request failed: ${e.message}`);
        return [];
    }
}

module.exports = { getStreams };
