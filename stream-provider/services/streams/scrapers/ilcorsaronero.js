const cheerio = require('cheerio');
const fetch = require('node-fetch');
const { extractQuality, extractInfoHash, parseSize, cleanSearchQuery } = require('../utils');

const BASE_URL = "https://ilcorsaronero.link";

async function fetchCorsaroNeroSingle(searchQuery, type = 'movie') {
    try {
        let acceptedCategories;
        let outputCategory;

        switch (type) {
            case 'movie':
                acceptedCategories = ['film', 'animazione - film'];
                outputCategory = 'Movies';
                break;
            case 'series':
                acceptedCategories = ['serie tv', 'animazione - serie'];
                outputCategory = 'TV';
                break;
            default:
                acceptedCategories = ['serie tv', 'animazione - serie'];
                outputCategory = 'TV';
        }

        const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const rows = $('tbody tr');

        if (rows.length === 0) return [];

        const filteredRows = rows.toArray().filter(row => {
            const firstTd = $(row).find('td').first();
            const categorySpan = firstTd.find('span');
            const category = categorySpan.length > 0
                ? categorySpan.text().trim().toLowerCase()
                : firstTd.text().trim().toLowerCase();

            return acceptedCategories.includes(category);
        });

        const MAX_DETAILS = 6;
        const rowsToProcess = filteredRows.slice(0, MAX_DETAILS);

        const streamPromises = rowsToProcess.map(async (row) => {
            const titleElement = $(row).find('th a');
            if (!titleElement.length) return null;

            const torrentTitle = titleElement.text().trim();
            const torrentPath = titleElement.attr('href');
            if (!torrentPath) return null;

            const cells = $(row).find('td');
            const sizeStr = cells.length > 3 ? cells.eq(3).text().trim() : 'Unknown';
            const sizeInBytes = parseSize(sizeStr);
            const seeds = $(row).find('td.text-green-500').text().trim() || '0';
            const leechs = $(row).find('td.text-red-500').text().trim() || '0';

            const torrentPageUrl = `${BASE_URL}${torrentPath}`;

            try {
                const detailRes = await fetch(torrentPageUrl, { headers: { 'Referer': searchUrl } });
                if (!detailRes.ok) return null;

                const detailHtml = await detailRes.text();
                const $$ = cheerio.load(detailHtml);

                let magnetLink = $$('a[href^="magnet:?"]').attr('href');
                if (!magnetLink) {
                    // Fallback regex search
                    const bodyHtml = $$.html();
                    const match = bodyHtml.match(/["'>\s](magnet:\?xt=urn:btih:[^"'\s<>]+)/i);
                    if (match) magnetLink = match[1];
                }

                if (magnetLink) {
                    const infoHash = extractInfoHash(magnetLink);
                    if (!infoHash) return null;

                    return {
                        title: torrentTitle,
                        magnetLink,
                        infoHash,
                        size: sizeStr,
                        sizeBytes: sizeInBytes,
                        seeders: parseInt(seeds),
                        leechers: parseInt(leechs),
                        source: 'CorsaroNero',
                        quality: extractQuality(torrentTitle)
                    };
                }
            } catch (e) {
                console.error(`[CorsaroNero] Error fetching detail: ${e.message}`);
            }
            return null;
        });

        const results = await Promise.all(streamPromises);
        return results.filter(r => r !== null);

    } catch (e) {
        console.error(`[CorsaroNero] Search error: ${e.message}`);
        return [];
    }
}

async function search(query, type) {
    const cleaned = cleanSearchQuery(query);
    if (!cleaned) return [];

    // Strategy 1: Cleaned query
    const results = await fetchCorsaroNeroSingle(cleaned, type);

    // Strategy 2: Simplified (remove 'movie', 'film')
    if (type === 'movie' && results.length === 0) {
        const simplified = cleaned.replace(/\b(movie|film|dvd|bluray|bd)\b/gi, '').trim();
        if (simplified && simplified !== cleaned && simplified.length > 2) {
            const extraResults = await fetchCorsaroNeroSingle(simplified, type);
            results.push(...extraResults);
        }
    }

    // Deduplicate by infoHash
    const unique = [];
    const seen = new Set();
    for (const r of results) {
        if (!seen.has(r.infoHash)) {
            seen.add(r.infoHash);
            unique.push(r);
        }
    }

    return unique;
}

module.exports = { search };
