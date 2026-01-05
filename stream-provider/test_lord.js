const cheerio = require('cheerio');
const { get } = require('./services/streams/utils/request');
const { findBestMatch } = require('./services/streams/utils/matcher');
const BASE_URL = "https://lordchannel.net";

async function debug_pipeline() {
    const query = "The Nun 1";
    console.log(`[DEBUG] 1. Searching for: ${query}`);

    // Step 1: Search
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const html = await get(searchUrl);

    if (!html) { console.log('[FAIL] No HTML from search'); return; }

    const $ = cheerio.load(html);
    const candidates = [];

    const seenLinks = new Set();
    $('a').each((i, el) => {
        const link = $(el).attr('href');
        const title = $(el).text().trim();
        if (!link || !title) return;
        const isContent = link.includes('/film/') || link.includes('/serie/') ||
            link.includes('/movies/') || link.includes('/tvshows/');
        if (isContent && !seenLinks.has(link)) {
            seenLinks.add(link);
            candidates.push({ title, link });
        }
    });

    console.log(`[DEBUG] 2. Candidates Found: ${candidates.length}`);

    // Step 2: Match
    const bestMatch = findBestMatch(query, candidates, 'movie');
    if (!bestMatch) {
        console.log('[FAIL] No match found.');
        return;
    }

    console.log(`[DEBUG] 3. Best Match: ${bestMatch.title} (${bestMatch.link})`);
    const fullLink = bestMatch.link.startsWith('http') ? bestMatch.link : `${BASE_URL}${bestMatch.link}`;

    // Step 3: Fetch Page
    console.log(`[DEBUG] 4. Fetching Movie Page: ${fullLink}`);
    const pageHtml = await get(fullLink);
    if (!pageHtml) { console.log('[FAIL] No Page HTML'); return; }

    const $$ = cheerio.load(pageHtml);
    const iframes = $$('iframe').length;
    console.log(`[DEBUG] 5. Iframes on Page: ${iframes}`);
    if (iframes > 0) {
        $$('iframe').each((i, el) => console.log(`   - Iframe: ${$$(el).attr('src')}`));
    }

    const streamLinks = [];
    $$('a').each((i, el) => {
        const href = $$(el).attr('href');
        if (href && (href.includes('stream') || href.includes('drive') || href.includes('cloud') || href.includes('emb.html') || href.includes('mixdrop'))) {
            if (!href.includes(BASE_URL) && !href.startsWith('/')) streamLinks.push(href);
        }
    });
    console.log(`[DEBUG] 6. Stream Links Found: ${streamLinks.length}`);

    // Check for login text
    const loginText = $$('body').text().includes('Per poter commentare devi loggarti') ? 'Yes' : 'No';
    console.log(`[DEBUG] Login required text found? ${loginText}`);

    if (iframes === 0 && streamLinks.length === 0) {
        console.log('[FAIL] No streams found on page.');
    } else {
        console.log('[PASS] Streams found!');
    }
}

debug_pipeline();
