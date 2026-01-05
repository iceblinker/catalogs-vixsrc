const cheerio = require('cheerio');
const fetch = require('node-fetch');
const { extractFromUrl } = require('../utils/extractor');

const BASE_URL = "https://www.animesaturn.cx";

async function get(url) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': BASE_URL
            }
        });
        if (!res.ok) return null;
        return await res.text();
    } catch (e) {
        console.error(`[AnimeSaturn] Fetch error for ${url}: ${e.message}`);
        return null;
    }
}

async function search(query, type, season, episode) {
    let searchName = query;
    let s = season;
    let e = episode;

    if (!s || !e) {
        const match = query.match(/(.+?)\s+S(\d+)E(\d+)/i);
        if (match) {
            searchName = match[1].trim();
            s = parseInt(match[2]);
            e = parseInt(match[3]);
        }
    }

    const searchUrl = `${BASE_URL}/animelist?search=${encodeURIComponent(searchName)}`;
    console.log(`[AnimeSaturn] Searching: ${searchUrl}`);
    const html = await get(searchUrl);
    if (!html) {
        console.log('[AnimeSaturn] No HTML returned');
        return [];
    }
    console.log(`[AnimeSaturn] HTML length: ${html.length}`);

    const $ = cheerio.load(html);
    let showLink = null;

    $('.item-archivio h3 a').each((i, el) => {
        const t = $(el).text().trim();
        const href = $(el).attr('href');
        console.log(`[AnimeSaturn] Candidate: ${t} -> ${href}`);

        // Exact match or contains
        if (t && t.toLowerCase().includes(searchName.toLowerCase())) {
            showLink = href;
            return false;
        }
    });

    if (!showLink) return [];
    if (!showLink.startsWith('http')) showLink = BASE_URL + showLink;

    console.log(`[AnimeSaturn] Show link found: ${showLink}`);
    const showHtml = await get(showLink);
    if (!showHtml) return [];
    const $show = cheerio.load(showHtml);

    const streams = [];

    if (s && e) {
        let epLink = null;
        $show('.episodi-link-button a').each((i, el) => {
            const t = $show(el).text().trim();
            const href = $show(el).attr('href');
            console.log(`[AnimeSaturn] Episode candidate: "${t}" -> ${href}`);

            // Extract episode number from "Episodio X"
            const match = t.match(/Episodio\s+(\d+)/i);
            if (match) {
                const num = parseInt(match[1]);
                if (num === parseInt(e)) {
                    epLink = href;
                    return false;
                }
            }
        });

        if (epLink) {
            console.log(`[AnimeSaturn] Episode link found: ${epLink}`);
            if (!epLink.startsWith('http')) epLink = BASE_URL + epLink;
            const epHtml = await get(epLink);
            if (epHtml) {
                const $ep = cheerio.load(epHtml);
                const watchLink = $ep('a[href*="/watch?file="]').attr('href');

                if (watchLink) {
                    const fullWatchLink = watchLink.startsWith('http') ? watchLink : BASE_URL + watchLink;
                    console.log(`[AnimeSaturn] Watch link found: ${fullWatchLink}`);
                    const watchHtml = await get(fullWatchLink);
                    if (watchHtml) {
                        const fileMatch = watchHtml.match(/file:\s*"([^"]+)"/);
                        if (fileMatch) {
                            const streamUrl = fileMatch[1];
                            console.log(`[AnimeSaturn] Stream URL found: ${streamUrl}`);
                            streams.push({
                                url: streamUrl,
                                title: `AnimeSaturn - Ep ${e}`
                            });
                        }
                    }
                }
            }
        } else {
            console.log(`[AnimeSaturn] Episode ${e} not found`);
        }
    }

    return streams.map(stream => ({
        ...stream,
        source: 'AnimeSaturn',
        isDirectStream: true
    }));
}

module.exports = { search };
