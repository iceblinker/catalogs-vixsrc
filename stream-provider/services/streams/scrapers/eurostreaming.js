const cheerio = require('cheerio');
const { get } = require('../utils/request');
const { extractFromUrl } = require('../utils/extractor');

const BASE_URL = "https://eurostreamings.pics";


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

    const searchUrl = `${BASE_URL}/wp-json/wp/v2/search?search=${encodeURIComponent(searchName)}&_fields=id,subtype`;
    console.log(`[Eurostreaming] Searching: ${searchUrl}`);
    const searchRes = await get(searchUrl);
    if (!searchRes) return [];

    let results;
    try {
        results = JSON.parse(searchRes);
        console.log(`[Eurostreaming] Search results count: ${results.length}`);
    } catch (e) {
        console.error(`[Eurostreaming] JSON parse error: ${e.message}`);
        return [];
    }

    const streams = [];

    const { findBestMatch } = require('../utils/matcher');

    // 1. Collect all candidates first
    const candidates = [];

    for (const result of results) {
        if (result.subtype !== 'post') continue;

        // We still need to fetch title from post endpoint because search result might be bare
        // Optimization: search endpoint with _fields=id,title,subtype could have given title directly?
        // The original code used: ?search=...&_fields=id,subtype
        // Let's stick to original fetch logic to be safe, but minimal fetch.

        let postUrl = `${BASE_URL}/wp-json/wp/v2/posts/${result.id}?_fields=title,content,link`;
        let postRes = await get(postUrl);
        if (!postRes) continue;

        let post;
        try { post = JSON.parse(postRes); } catch (e) { continue; }

        let title = post.title.rendered;
        let content = post.content.rendered;

        // Check for JS redirect (logic preserved)
        const redirectMatch = content.match(/top\.location\.href\s*=\s*["']([^"']+)["']/);
        if (redirectMatch) {
            let redirectPath = redirectMatch[1];
            const idMatch = redirectPath.match(/[?&]p=(\d+)/);
            if (idMatch) {
                const newId = idMatch[1];
                postUrl = `${BASE_URL}/wp-json/wp/v2/posts/${newId}?_fields=title,content`;
                const newPostRes = await get(postUrl);
                if (newPostRes) {
                    try {
                        const newPost = JSON.parse(newPostRes);
                        title = newPost.title?.rendered || title;
                        content = newPost.content?.rendered || content;
                        post = newPost; // update post object for later use
                    } catch (e) { }
                }
            }
        }

        candidates.push({
            title: title,
            id: result.id,
            content: content,  // Store content so we don't fetch again
            link: post.link
        });
    }

    // 2. Find Best Match
    const bestMatch = findBestMatch(searchName, candidates, type);

    if (bestMatch) {
        console.log(`[Eurostreaming] Processing best match: ${bestMatch.title}`);
        const content = bestMatch.content;

        // 3. Process the Winner
        if (s && e) {
            const $ = cheerio.load(content);
            let seasonFound = false;

            $('.su-spoiler').each((i, el) => {
                const spoilerTitle = $(el).find('.su-spoiler-title').text().trim();
                const seasonMatch = spoilerTitle.match(/(?:Stagione|Season)\s*(\d+)/i);

                if (seasonMatch && parseInt(seasonMatch[1]) === parseInt(s)) {
                    seasonFound = true;
                    console.log(`[Eurostreaming] Found Season ${s}`);

                    const spoilerContent = $(el).find('.su-spoiler-content').html();
                    const lines = spoilerContent.split(/<br\s*\/?>/i);

                    for (const line of lines) {
                        const cleanLine = line.trim();
                        const epRegex = new RegExp(`^\\s*0?${e}\\s*(?:[-–—]|x|×|\\s)`, 'i');

                        if (epRegex.test(cleanLine.replace(/<[^>]+>/g, ''))) {
                            console.log(`[Eurostreaming] Found Episode ${e} line: ${cleanLine}`);
                            const $line = cheerio.load(cleanLine);
                            $line('a').each((j, link) => {
                                const href = $(link).attr('href');
                                if (href) {
                                    console.log(`[Eurostreaming] Found link: ${href}`);
                                    streams.push({
                                        url: href,
                                        title: `Eurostreaming - S${s}E${e}`,
                                        behaviorHints: { notWebReady: true }
                                    });
                                }
                            });
                        }
                    }
                }
            });
        }
    }

    // Resolve streams
    const resolvedStreams = [];
    for (const stream of streams) {
        const { streams: st } = await extractFromUrl(stream.url);
        resolvedStreams.push(...st);
    }

    return resolvedStreams.map(stream => ({
        ...stream,
        source: 'Eurostreaming',
        isDirectStream: true
    }));
}

module.exports = { search };
