const fetch = require('node-fetch');

class Torbox {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.torbox.app/v1/api';
    }

    async checkCache(hashes) {
        if (!hashes || hashes.length === 0) return {};

        const results = {};

        try {
            const response = await fetch(`${this.baseUrl}/torrents/checkcached`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hashes: hashes,
                    format: 'object',
                    list_files: true
                })
            });

            if (!response.ok) {
                throw new Error(`Torbox API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.data) {
                hashes.forEach(hash => {
                    const hashLower = hash.toLowerCase();
                    const cacheInfo = data.data[hashLower];
                    const isCached = !!cacheInfo;

                    results[hashLower] = {
                        cached: isCached,
                        files: cacheInfo?.files || [],
                        service: 'Torbox'
                    };
                });
            }
        } catch (error) {
            console.error('[Torbox] Cache check error:', error.message);
        }

        return results;
    }

    async addMagnet(magnetLink) {
        const response = await fetch(`${this.baseUrl}/torrents/createtorrent`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ magnet: magnetLink })
        });

        if (!response.ok) {
            throw new Error(`Torbox addMagnet error: ${response.status}`);
        }

        return await response.json();
    }
}

module.exports = Torbox;
