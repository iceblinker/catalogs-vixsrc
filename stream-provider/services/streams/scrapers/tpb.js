const fetch = require('node-fetch');
const { parseSize } = require('../utils');

class ThePirateBay {
    constructor() {
        this.baseUrl = 'https://apibay.org';
        this.trackers = [
            'udp://tracker.coppersurfer.tk:6969/announce',
            'udp://9.rarbg.to:2920/announce',
            'udp://tracker.opentrackr.org:1337',
            'udp://tracker.internetwarriors.net:1337/announce',
            'udp://tracker.leechers-paradise.org:6969/announce',
            'udp://tracker.pirateparty.gr:6969/announce',
            'udp://tracker.cyberia.is:6969/announce'
        ];
    }

    async getStreams(query) {
        if (!query) return [];

        try {
            // Category 200 = Video
            const url = `${this.baseUrl}/q.php?q=${encodeURIComponent(query)}&cat=200`;
            console.log(`[TPB] Searching: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                console.error(`[TPB] HTTP Error: ${response.status}`);
                return [];
            }

            const results = await response.json();

            if (!results || !Array.isArray(results) || (results.length === 1 && results[0].id === '0')) {
                return [];
            }

            return results.map(result => {
                const title = result.name;
                const infoHash = result.info_hash;

                if (!title || !infoHash) return null;

                const trackersStr = this.trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');
                const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${trackersStr}`;

                return {
                    title: title,
                    name: `[TPB] ${title}`,
                    size: parseInt(result.size),
                    seeders: parseInt(result.seeders),
                    leechers: parseInt(result.leechers),
                    infoHash: infoHash,
                    magnet: magnet,
                    source: 'TPB',
                    uploadDate: new Date(parseInt(result.added) * 1000).toISOString(),
                    verified: result.status === 'vip' || result.status === 'trusted'
                };
            }).filter(Boolean);

        } catch (e) {
            console.error(`[TPB] Error: ${e.message}`);
            return [];
        }
    }
}

module.exports = new ThePirateBay();
