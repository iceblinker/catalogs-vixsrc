const fetch = require('node-fetch');
const { parseReleaseInfo } = require('../utils/releaseParser');

const BASE_URL = 'https://addon.debridio.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class DebridioScraper {
    constructor() {
        this.headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
        };
    }

    getConfig() {
        const apiKey = process.env.DEBRIDIO_API_KEY;
        const rdKey = process.env.REALDEBRID_API_KEY;

        if (!apiKey) {
            console.warn('[Debridio] Missing DEBRIDIO_API_KEY');
            return null;
        }

        if (!rdKey) {
            console.warn('[Debridio] Missing REALDEBRID_API_KEY (required for provider)');
            return null;
        }

        const config = {
            api_key: apiKey,
            provider: 'realdebrid',
            providerKey: rdKey,
            disableUncached: false,
            resolutions: ['4k', '2160p', '1440p', '1080p', '720p', '480p', '360p', 'unknown'],
            excludedQualities: [],
        };

        return Buffer.from(JSON.stringify(config)).toString('base64');
    }

    async getStreams(type, id) {
        try {
            const configStr = this.getConfig();
            if (!configStr) return [];

            // Debridio expects /stream/{type}/{id}.json
            const url = `${BASE_URL}/${configStr}/stream/${type}/${id}.json`;
            console.log(`[Debridio] Fetching streams for ${type} ${id}`);

            const res = await fetch(url, { headers: this.headers });

            if (!res.ok) {
                console.error(`[Debridio] HTTP Error ${res.status} accessing ${url}`);
                return [];
            }

            const data = await res.json();

            if (!data.streams || !Array.isArray(data.streams)) {
                return [];
            }

            // Filter for Italian language
            const filteredStreams = data.streams.filter(stream => {
                const name = stream.name || '';
                const title = stream.title || '';
                const description = stream.description || '';

                // Parse release info from title/name (usually title has the filename)
                const filename = title || name || '';
                const info = parseReleaseInfo(filename);

                // Check parsed languages
                const isItalianParsed = info.languages.some(l => l.includes('ITA'));

                // Fallback regex check on raw strings
                const rawCheck = (str) => /ITA|ITALIAN/i.test(str);

                const isItalianRaw = rawCheck(name) || rawCheck(title) || rawCheck(description);

                return isItalianParsed || isItalianRaw;
            });

            console.log(`[Debridio] Found ${data.streams.length} streams, ${filteredStreams.length} kept (Italian filter).`);

            return filteredStreams.map(stream => {
                const filename = stream.behaviorHints?.filename || stream.title || stream.name;
                return {
                    ...stream,
                    title: filename, // Critical for streamService to parse info
                    isDirectStream: true, // It provides a direct URL
                    name: `[Debridio] ${stream.name || 'Stream'}`,
                    behaviorHints: {
                        ...stream.behaviorHints,
                        bingeGroup: `debridio-${stream.infoHash || 'stream'}`
                    }
                };
            });

        } catch (e) {
            console.error(`[Debridio] Error: ${e.message}`);
            return [];
        }
    }
}

module.exports = new DebridioScraper();
