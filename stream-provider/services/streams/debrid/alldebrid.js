const fetch = require('node-fetch');

class AllDebrid {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.alldebrid.com/v4';
    }

    async checkCache(hashes) {
        if (!hashes || hashes.length === 0) return {};

        const results = {};

        try {
            const magnetList = hashes.map(h => `magnet:?xt=urn:btih:${h}`).join('|');

            const response = await fetch(`${this.baseUrl}/magnet/instant?agent=stremizio&apikey=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `magnets[]=${encodeURIComponent(magnetList)}`
            });

            if (!response.ok) {
                throw new Error(`AllDebrid API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.data && data.data.magnets) {
                data.data.magnets.forEach((magnet, index) => {
                    const hash = hashes[index].toLowerCase();
                    const isCached = magnet.instant === true;

                    results[hash] = {
                        cached: isCached,
                        files: magnet.files || [],
                        service: 'AllDebrid'
                    };
                });
            }
        } catch (error) {
            console.error('[AllDebrid] Cache check error:', error.message);
        }

        return results;
    }

    async unrestrictLink(link) {
        const response = await fetch(`${this.baseUrl}/link/unlock?agent=stremizio&apikey=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `link=${encodeURIComponent(link)}`
        });

        if (!response.ok) {
            throw new Error(`AllDebrid unrestrict error: ${response.status}`);
        }

        return await response.json();
    }

    async addMagnet(magnetLink) {
        const response = await fetch(`${this.baseUrl}/magnet/upload?agent=stremizio&apikey=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `magnets[]=${encodeURIComponent(magnetLink)}`
        });

        if (!response.ok) {
            throw new Error(`AllDebrid addMagnet error: ${response.status}`);
        }

        return await response.json();
    }
}

module.exports = AllDebrid;
