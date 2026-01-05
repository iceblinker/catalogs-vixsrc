const fetch = require('node-fetch');
const FormData = require('form-data');

class RealDebrid {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.real-debrid.com/rest/1.0';
    }

    async checkCache(hashes) {
        if (!hashes || hashes.length === 0) return {};

        const results = {};
        const batchSize = 40; // RD API limit

        for (let i = 0; i < hashes.length; i += batchSize) {
            const batch = hashes.slice(i, i + batchSize);
            const url = `${this.baseUrl}/torrents/instantAvailability/${batch.join('/')}`;

            try {
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${this.apiKey}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    batch.forEach(hash => {
                        const hashLower = hash.toLowerCase();
                        const cacheInfo = data[hashLower];
                        // Consider cached if RD has ANY variant available
                        const isCached = cacheInfo && cacheInfo.rd && cacheInfo.rd.length > 0;

                        results[hashLower] = {
                            cached: isCached,
                            variants: cacheInfo?.rd || [],
                            service: 'Real-Debrid'
                        };
                    });
                } else {
                    // Handle specific errors
                    if (response.status === 403) {
                        try {
                            const errBody = await response.text();
                            if (errBody.includes('"error_code":37') || errBody.includes('disabled_endpoint')) {
                                console.warn('[RealDebrid] Instant Availability endpoint disabled (Error 37). Assuming not cached.');
                                // Return empty results (not cached) for this batch
                                batch.forEach(hash => {
                                    results[hash.toLowerCase()] = { cached: false, variants: [], service: 'Real-Debrid' };
                                });
                                continue;
                            }
                            console.error(`[RealDebrid] Cache check failed: ${response.status} ${response.statusText} - ${errBody}`);
                        } catch (e) {
                            console.error(`[RealDebrid] Cache check failed: ${response.status}`);
                        }
                    } else {
                        console.error(`[RealDebrid] Cache check failed: ${response.status}`);
                    }
                }

                // Rate limiting
                if (i + batchSize < hashes.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[RealDebrid] Cache check error:', error.message);
            }
        }

        return results;
    }

    async unrestrictLink(link) {
        const form = new FormData();
        form.append('link', link);

        const response = await fetch(`${this.baseUrl}/unrestrict/link`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                ...form.getHeaders()
            },
            body: form
        });

        if (!response.ok) {
            throw new Error(`Real-Debrid unrestrict error: ${response.status}`);
        }

        return await response.json();
    }

    async addMagnet(magnetLink) {
        const form = new FormData();
        form.append('magnet', magnetLink);

        const response = await fetch(`${this.baseUrl}/torrents/addMagnet`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                ...form.getHeaders()
            },
            body: form
        });

        if (!response.ok) {
            throw new Error(`Real-Debrid addMagnet error: ${response.status}`);
        }

        return await response.json();
    }
}

module.exports = RealDebrid;
