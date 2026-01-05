const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { extractFromUrl } = require('../utils/extractor');

const BASE_URL = 'https://www.animeunity.so';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

class AnimeUnityScraper {
    constructor() {
        this.session = {
            cookies: {},
            csrfToken: null,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': BASE_URL,
                'Referer': BASE_URL
            }
        };
    }

    async initSession() {
        if (this.session.csrfToken) return;

        try {
            console.log('[AnimeUnity] Initializing session...');
            const res = await fetch(BASE_URL, {
                headers: { 'User-Agent': USER_AGENT }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // Extract Cookies
            const rawCookies = res.headers.raw()['set-cookie'];
            if (rawCookies) {
                rawCookies.forEach(c => {
                    const [keyVal] = c.split(';');
                    const [key, val] = keyVal.split('=');
                    this.session.cookies[key] = val;
                });
            }

            // Extract CSRF Token
            const html = await res.text();
            const $ = cheerio.load(html);
            const token = $('meta[name="csrf-token"]').attr('content');

            if (!token) throw new Error('CSRF token not found');

            this.session.csrfToken = token;
            this.session.headers['X-CSRF-Token'] = token;
            this.session.headers['Cookie'] = Object.entries(this.session.cookies)
                .map(([k, v]) => `${k}=${v}`).join('; ');

            console.log('[AnimeUnity] Session initialized');
        } catch (e) {
            console.error(`[AnimeUnity] Session init failed: ${e.message}`);
            throw e;
        }
    }

    async search(query, type = 'series') {
        try {
            await this.initSession();

            console.log(`[AnimeUnity] Searching for: ${query}`);
            const payload = {
                title: query,
                type: false,
                year: false,
                order: "Lista A-Z",
                status: false,
                genres: false,
                season: false,
                offset: 0,
                dubbed: false // Search subbed first
            };

            const res = await fetch(`${BASE_URL}/archivio/get-animes`, {
                method: 'POST',
                headers: {
                    ...this.session.headers,
                    'Content-Type': 'application/json;charset=UTF-8'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`Search HTTP ${res.status}`);

            const data = await res.json();
            return (data.records || []).map(record => ({
                id: record.id,
                slug: record.slug,
                title: record.title_it || record.title_eng || record.title,
                episodes_count: record.episodes_count
            }));

        } catch (e) {
            console.error(`[AnimeUnity] Search failed: ${e.message}`);
            return [];
        }
    }

    async getEpisodes(animeId) {
        try {
            await this.initSession();

            let allEpisodes = [];
            let start = 1;
            const range = 120;

            while (true) {
                const end = start + range - 1;
                const url = `${BASE_URL}/info_api/${animeId}/1?start_range=${start}&end_range=${end}`;
                // console.log(`[AnimeUnity] Fetching episodes: ${start}-${end}`);

                const res = await fetch(url, {
                    headers: this.session.headers
                });

                if (!res.ok) throw new Error(`Episodes HTTP ${res.status}`);

                const data = await res.json();
                const batch = data.episodes || [];

                if (batch.length === 0) break;

                allEpisodes = allEpisodes.concat(batch);

                if (batch.length < range) break; // Less than full batch means we reached the end

                start += range;

                // Safety break
                if (start > 3000) break;
            }

            return allEpisodes;

        } catch (e) {
            console.error(`[AnimeUnity] Get Episodes failed: ${e.message}`);
            return [];
        }
    }

    async getStreamUrl(animeId, slug, episodeId) {
        try {
            const pageUrl = `${BASE_URL}/anime/${animeId}-${slug}/${episodeId}`;
            console.log(`[AnimeUnity] Fetching stream page: ${pageUrl}`);

            const res = await fetch(pageUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Cookie': Object.entries(this.session.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
                }
            });

            if (!res.ok) throw new Error(`Stream Page HTTP ${res.status}`);

            const html = await res.text();
            const $ = cheerio.load(html);

            let embedUrl = $('video-player').attr('embed_url');

            if (!embedUrl) {
                embedUrl = $('iframe[src*="vixcloud"]').attr('src');
            }

            if (!embedUrl) {
                console.log('[AnimeUnity] No embed URL found');
                return null;
            }

            console.log(`[AnimeUnity] Found embed URL: ${embedUrl}`);

            const { streams } = await extractFromUrl(embedUrl);
            if (streams && streams.length > 0) {
                return streams[0].url;
            }
            return null;

        } catch (e) {
            console.error(`[AnimeUnity] Get Stream URL failed: ${e.message}`);
            return null;
        }
    }

    async searchAndResolve(query, type, season, episode) {
        const results = await this.search(query);
        if (!results.length) return [];

        const anime = results[0];
        console.log(`[AnimeUnity] Selected anime: ${anime.title} (${anime.id})`);

        const episodes = await this.getEpisodes(anime.id);
        if (!episodes.length) return [];

        let targetEpisode;
        if (episode) {
            targetEpisode = episodes.find(ep => ep.number == episode);
        } else {
            targetEpisode = episodes[0];
        }

        if (!targetEpisode) {
            console.log(`[AnimeUnity] Episode ${episode} not found`);
            return [];
        }

        console.log(`[AnimeUnity] Selected episode: ${targetEpisode.number}`);

        const streamUrl = await this.getStreamUrl(anime.id, anime.slug, targetEpisode.id);

        if (!streamUrl) return [];

        return [{
            name: 'AnimeUnity',
            title: `${anime.title}\nEp. ${targetEpisode.number} [VixCloud]`,
            url: streamUrl,
            behaviorHints: {
                notWebReady: true
            }
        }];
    }
}

module.exports = new AnimeUnityScraper();
