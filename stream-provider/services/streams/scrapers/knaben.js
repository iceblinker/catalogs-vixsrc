const fetch = require('node-fetch');

const BASE_URL = 'https://api.knaben.org/v1';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class KnabenScraper {
    constructor() {
        this.headers = {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/json'
        };
    }

    async search(query) {
        try {
            console.log(`[Knaben] Searching for: ${query}`);
            const payload = {
                query: query,
                size: 100,
                hide_xxx: true
            };

            const res = await fetch(BASE_URL, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            if (!data.hits || !Array.isArray(data.hits)) {
                return [];
            }

            return data.hits.map(item => ({
                title: item.title,
                size: item.bytes,
                seeders: item.seeders,
                leechers: item.peers - item.seeders, // peers usually means total swarm? Knaben docs say 'peers' and 'seeders'.
                magnet: item.magnetUrl,
                infoHash: item.hash,
                category: item.category,
                uploadDate: item.date,
                tracker: item.tracker
            }));

        } catch (e) {
            console.error(`[Knaben] Search failed: ${e.message}`);
            return [];
        }
    }

    async getStreams(query) {
        const results = await this.search(query);

        return results.map(item => ({
            name: `[${item.tracker}]`, // Knaben aggregates, so source tracker is useful
            title: `${item.title}\n👤 ${item.seeders} 💾 ${this.formatSize(item.size)}`,
            size: item.size, // Raw size in bytes
            infoHash: item.infoHash,
            magnet: item.magnet || `magnet:?xt=urn:btih:${item.infoHash}&dn=${encodeURIComponent(item.title)}`,
            behaviorHints: {
                bingeGroup: `knaben-${item.infoHash}`
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

module.exports = new KnabenScraper();
