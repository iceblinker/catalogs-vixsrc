const fetch = require('node-fetch');
const settings = require('../../../config/settings');

const BASE_URL = 'https://api.torbox.app/v1/api';

async function getStreams(query) {
    const apiKey = settings.TORBOX_API_KEY;
    if (!apiKey) return [];

    console.error(`[TorBox] Searching for: ${query}`);

    try {
        // Search TorBox internal index
        const url = `${BASE_URL}/torrents/search?query=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!res.ok) {
            console.error(`[TorBox] API Error: ${res.status}`);
            return [];
        }

        const data = await res.json();
        if (!data.success || !Array.isArray(data.data)) return [];

        return data.data.map(item => ({
            name: `TorBox\n${item.resolution || 'Unknown'}`,
            title: item.name,
            infoHash: item.hash,
            size: item.size,
            seeders: item.seeders || 0,
            source: 'TorBox',
            cached: true, // It's from their index, so it's likely cached or at least tracked
            behaviorHints: {
                bingeGroup: `torbox-${item.hash}`
            }
        }));

    } catch (e) {
        console.error(`[TorBox] Error: ${e.message}`);
        return [];
    }
}

module.exports = { getStreams };
