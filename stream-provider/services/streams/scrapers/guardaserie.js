const cheerio = require('cheerio');
const { get } = require('../utils/request');
const { extractFromUrl } = require('../utils/extractor');

const BASE_URL = "https://guardaserie.school";

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

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(searchName)}`;
    console.log(`[Guardaserie] Searching: ${searchUrl}`);
    const html = await get(searchUrl);
    if (!html) return [];
    console.log(`[Guardaserie] HTML length: ${html.length}`);

    const $ = cheerio.load(html);
    const results = [];

    $('.ml-item').each((i, el) => {
        const link = $(el).find('a').attr('href');
        const title = $(el).find('.mli-info h2').text().trim();
        console.log(`[Guardaserie] Found result: ${title} -> ${link}`);
        if (link && title) {
            results.push({ title, link });
        }
    });

    const { findBestMatch } = require('../utils/matcher');

    // ... (inside search function) ...
    // Note: We need to parse results first, then match.
    // The loop iterates via cheerio. We should collect all candidates first.
    // results array is already built in lines 30-37.

    // Legacy logic: 
    /*
    const bestMatch = results.find(r => r.title.toLowerCase().includes(searchName.toLowerCase()));

    if (!bestMatch) {
        console.log('[Guardaserie] No best match found.');
        return [];
    }
    console.log(`[Guardaserie] Best match: ${bestMatch.title}`);
    */

    // New Logic:
    const bestMatch = findBestMatch(searchName, results, type);
    if (!bestMatch) return [];

    // ... continue ...

    const pageHtml = await get(bestMatch.link);
    if (!pageHtml) return [];

    const $$ = cheerio.load(pageHtml);
    const streams = [];

    if (type === 'series' && s && e) {
        const epId = `serie-${s}_${e}`;
        console.log(`[Guardaserie] Looking for episode ID: ${epId}`);

        const anchor = $$(`a[id="${epId}"]`);
        console.log(`[Guardaserie] Anchor found: ${anchor.length}`);

        const linksToResolve = new Set();

        if (anchor.length) {
            const dl = anchor.attr('data-link');
            if (dl) linksToResolve.add(dl);

            anchor.closest('li').find('[data-link]').each((i, el) => {
                const l = $$(el).attr('data-link');
                if (l) linksToResolve.add(l);
            });
        }

        for (const l of linksToResolve) {
            console.log(`[Guardaserie] Resolving link: ${l}`);
            const { streams: s } = await extractFromUrl(l);
            streams.push(...s);
        }

    } else {
        // Movie logic
        const linksToResolve = new Set();
        $$('.mirrors [data-link]').each((i, el) => {
            const l = $$(el).attr('data-link');
            if (l) linksToResolve.add(l);
        });

        $$('iframe').each((i, el) => {
            const src = $$(el).attr('src');
            if (src) linksToResolve.add(src);
        });

        for (const l of linksToResolve) {
            const { streams: s } = await extractFromUrl(l);
            streams.push(...s);
        }
    }

    return streams.map(stream => ({
        ...stream,
        source: 'Guardaserie',
        size: 'N/A',
        seeders: 0,
        isDirectStream: true
    }));
}

module.exports = { search };
