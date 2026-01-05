const fetch = require('node-fetch');

const BASE_URL = 'https://torrentgalaxy.space';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class TorrentGalaxyScraper {
    constructor() {
        this.headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
        };
    }

    async search(query) {
        try {
            console.log(`[TorrentGalaxy] Searching for: ${query}`);
            const url = `${BASE_URL}/get-posts/keywords:${encodeURIComponent(query)}:format:json`;

            const res = await fetch(url, { headers: this.headers });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            if (!data.results || !Array.isArray(data.results)) {
                return [];
            }

            return data.results.map(item => ({
                title: item.n, // n = name/title
                size: item.s,  // s = size
                seeders: item.se, // se = seeders
                leechers: item.le, // le = leechers
                magnet: item.magnet, // magnet seems to be missing in raw response, might need construction or it's 'd'? No, wait.
                // Let's check the raw response sample again. 
                // The sample showed: pk, n, a, c, s, t, u, se, le, i, h, tg.
                // It does NOT have 'magnet'.
                // But it has 'h' (hash). We can construct magnet from hash.
                infoHash: item.h,
                category: item.c,
                uploadDate: item.a
            }));

        } catch (e) {
            console.error(`[TorrentGalaxy] Search failed: ${e.message}`);
            return [];
        }
    }

    async getStreams(query) {
        const results = await this.search(query);

        return results.map(item => ({
            name: 'TGx',
            title: `${item.title}\n👤 ${item.seeders} 💾 ${this.formatSize(item.size)}`,
            size: item.size, // Raw size in bytes
            infoHash: item.infoHash,
            magnet: `magnet:?xt=urn:btih:${item.infoHash}&dn=${encodeURIComponent(item.title)}`,
            behaviorHints: {
                bingeGroup: `tgx-${item.infoHash}`
            }
        }));
    }

    formatSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new TorrentGalaxyScraper();
