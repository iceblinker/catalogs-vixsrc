const cheerio = require('cheerio');
const { get } = require('../utils/request');
const { extractFromUrl } = require('../utils/extractor');
const { findBestMatch } = require('../utils/matcher');

const BASE_URL = "https://lordchannel.net";

async function search(query, type, season, episode) {
    // 1. Prepare Query
    let searchName = query;
    if (type === 'series') {
        searchName = query.replace(/\s*s\d+e\d+.*/i, '').trim();
    }

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(searchName)}`;
    console.log(`[LordChannel] Searching: ${searchUrl}`);
    
    let html;
    try {
        html = await get(searchUrl);
    } catch(e) {
        console.error(`[LordChannel] Search failed: ${e.message}`);
        return [];
    }
    
    if (!html) return [];

    const $ = cheerio.load(html);
    const candidates = [];

    // 2. Generic Link Scraping Strategy
    const seenLinks = new Set();
    let debugCount = 0;
    
    $('a').each((i, el) => {
        const link = $(el).attr('href');
        const title = $(el).text().trim();
        
        if (debugCount < 10) {
            console.log(`[LordChannel] Link Check ${i}: [${title}] -> ${link}`);
            debugCount++;
        }
        
        if (!link || !title) return;
        
        // Filter for Content Links
        const isContent = link.includes('/film/') || link.includes('/serie/') || 
                          link.includes('/movies/') || link.includes('/tvshows/');
                          
        if (isContent && !seenLinks.has(link)) {
            seenLinks.add(link);
            
            // Quality Check
            const parentText = $(el).closest('article, .item, li').text() || ""; 
            const hasFullHd = parentText.includes('FULL HD') || title.includes('FULL HD');
            const qualityLabel = hasFullHd ? 'FULL HD' : 'HD';

            candidates.push({
                title: title,
                link: link, // Relative or Absolute
                quality: qualityLabel,
                hasFullHd: hasFullHd
            });
        }
    });

    console.log(`[LordChannel] Found ${candidates.length} candidates.`);

    // 3. Find Best Match
    const bestMatch = findBestMatch(searchName, candidates, type);
    if (!bestMatch) return [];

    console.log(`[LordChannel] Best match: ${bestMatch.title}`);

    // 4. Fetch Page & Extract Streams
    const fullLink = bestMatch.link.startsWith('http') ? bestMatch.link : `${BASE_URL}${bestMatch.link}`;
    console.log(`[LordChannel] Fetching Result Page: ${fullLink}`);
    
    let pageHtml;
    try {
         pageHtml = await get(fullLink);
    } catch(e) {
         console.error(`[LordChannel] Page fetch failed: ${e.message}`);
         return [];
    }
    
    if (!pageHtml) return [];
    
    const $$ = cheerio.load(pageHtml);
    const streams = [];

    if (type === 'series' && season && episode) {
        const content = $$('body').html();
        if (content) {
             const rows = content.split(/<br\s*\/?>/i);
             for (const row of rows) {
                 if (row.includes(`${season}×${episode}`) || row.includes(`${season}x${episode}`) || row.includes(`${season} - ${episode}`)) {
                      const $row = cheerio.load(row);
                      $row('a').each((j, a) => {
                          const href = $row(a).attr('href');
                          if (href) {
                               streams.push({
                                  url: href,
                                  title: `LordChannel - S${season}E${episode}`
                              });
                          }
                      });
                 }
             }
        }
        $$('li').each((i, el) => {
             const text = $$(el).text();
             if (text.includes(`${season}x${episode}`) || text.includes(`${season}×${episode}`)) {
                 $$(el).find('a').each((j, a) => {
                     const href = $$(a).attr('href');
                     if (href) streams.push({ url: href, title: `LordChannel - S${season}E${episode}` });
                 });
             }
        });

    } else {
        // Movie Logic
        $$('iframe').each((i, el) => {
            const src = $$(el).attr('src');
            if (src) {
                streams.push({
                    url: src,
                    title: `LordChannel - Movie`
                });
            }
        });
        
        $$('a').each((i, el) => {
             const href = $$(el).attr('href');
             if (href && (href.includes('stream') || href.includes('drive') || href.includes('cloud') || href.includes('emb.html'))) {
                  if (!href.includes(BASE_URL) && !href.startsWith('/')) {
                      streams.push({
                        url: href,
                        title: `LordChannel - Movie`
                    });
                  }
             }
        });
    }

    console.log(`[LordChannel] Found ${streams.length} raw streams/iframes.`);

    // 5. Resolve Streams
    const resolvedStreams = [];
    for (const s of streams) {
        const { streams: st } = await extractFromUrl(s.url);
        resolvedStreams.push(...st);
    }
    
    return resolvedStreams.map(s => ({
        ...s,
        source: 'LordChannel',
        isDirectStream: true,
        behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
                request: { "Referer": BASE_URL }
            }
        }
    }));
}

module.exports = { search };
