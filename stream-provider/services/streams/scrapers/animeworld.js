const cheerio = require('cheerio');
const fetch = require('node-fetch');
const { extractFromUrl } = require('../utils/extractor');

const BASE_URL = "https://www.animeworld.ac";

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
        console.error(`[AnimeWorld] Fetch error for ${url}: ${e.message}`);
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

    const searchUrl = `${BASE_URL}/filter?keyword=${encodeURIComponent(searchName)}`;
    console.log(`[AnimeWorld] Searching: ${searchUrl}`);
    const html = await get(searchUrl);
    if (!html) {
        console.log('[AnimeWorld] No HTML returned');
        return [];
    }
    console.log(`[AnimeWorld] HTML length: ${html.length}`);

    const $ = cheerio.load(html);
    let showLink = null;

    $('.item .name').each((i, el) => {
        const t = $(el).text().trim();
        const href = $(el).attr('href');
        console.log(`[AnimeWorld] Candidate: ${t} -> ${href}`);

        if (t && t.toLowerCase().includes(searchName.toLowerCase())) {
            showLink = href;
            return false;
        }
    });

    if (!showLink) {
        console.log('[AnimeWorld] No show link found');
        return [];
    }
    if (!showLink.startsWith('http')) showLink = BASE_URL + showLink;

    console.log(`[AnimeWorld] Show link found: ${showLink}`);
    const showHtml = await get(showLink);
    if (!showHtml) return [];
    const $show = cheerio.load(showHtml);

    const streams = [];

    if (s && e) {
        let epLink = null;
        // Need to inspect the show page to find correct selector for episodes
        // Assuming .server .episodes .episode a for now, but will log
        $show('.server .episodes .episode a').each((i, el) => {
            const t = $show(el).text().trim();
            const href = $show(el).attr('href');
            console.log(`[AnimeWorld] Episode candidate: ${t} -> ${href}`);

            const num = parseInt(t);
            if (num === parseInt(e)) {
                epLink = href;
                return false;
            }
        });

        if (epLink) {
            console.log(`[AnimeWorld] Episode link found: ${epLink}`);
            // Extract ID from epLink (last part)
            const parts = epLink.split('/');
            const epId = parts[parts.length - 1];
            
            if (epId) {
                console.log(`[AnimeWorld] Episode ID: ${epId}`);
                const apiUrl = `${BASE_URL}/api/episode/info?id=${epId}`;
                const apiRes = await get(apiUrl); // get returns text, need to parse
                
                if (apiRes) {
                    try {
                        const json = JSON.parse(apiRes);
                        if (json.grabber) {
                            let streamUrl = json.grabber;
                            console.log(`[AnimeWorld] Stream URL found: ${streamUrl}`);
                            
                            // Check if it's a direct link or needs resolving
                            if (streamUrl.includes('sweetpixel') || streamUrl.endsWith('.mp4')) {
                                streams.push({
                                    url: streamUrl,
                                    title: `AnimeWorld - Ep ${e}`
                                });
                            } else {
                                const { streams: st } = await extractFromUrl(streamUrl);
                                streams.push(...st);
                            }
                        }
                    } catch (e) {
                        console.error(`[AnimeWorld] API parse error: ${e.message}`);
                    }
                }
            }
        } else {
            console.log(`[AnimeWorld] Episode ${e} not found`);
        }
    }

    return streams.map(stream => ({
        ...stream,
        source: 'AnimeWorld',
        isDirectStream: true
    }));
}

module.exports = { search };
