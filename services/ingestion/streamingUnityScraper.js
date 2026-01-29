const { getStealthPage, closeBrowser } = require('./stealthBrowser');
const { mapCommon } = require('./processor');
const { fetchTMDB } = require('./tmdbClient');
const { normalizeTitlesBatch } = require('./googleAiClient');
const { getDatabase } = require('../../lib/db');
const movieRepo = require('../../lib/db/repositories/movieRepository');
const tvRepo = require('../../lib/db/repositories/tvRepository');
const fs = require('fs');
const path = require('path');

// Known StreamingUnity domains to try (in order of preference)
const KNOWN_DOMAINS = [
    'https://streamingunity.so',
    'https://streamingunity.tv',
    'https://streamingunity.co',
    'https://streamingunity.net',
    'https://streamingunity.org'
];

// Fallback base URL from env, or first known domain
const ENV_BASE_URL = process.env.STREAMINGUNITY_BASE_URL;

// Cache the resolved domain for this session
let resolvedBaseUrl = null;

/**
 * Resolve the current working StreamingUnity domain by following redirects
 * @param {Function} log - Logger function
 * @returns {Promise<string>} - The resolved base URL
 */
async function resolveCurrentDomain(log = console.log) {
    if (resolvedBaseUrl) return resolvedBaseUrl;

    const domainsToTry = ENV_BASE_URL ? [ENV_BASE_URL, ...KNOWN_DOMAINS] : KNOWN_DOMAINS;

    for (const domain of domainsToTry) {
        try {
            log(`[DomainResolver] Trying ${domain}...`);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(domain, {
                method: 'HEAD',
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timeout);

            // Get the final URL after redirects
            const finalUrl = new URL(response.url);
            const resolvedDomain = `${finalUrl.protocol}//${finalUrl.host}`;

            if (response.ok || response.status === 403) { // 403 might be Cloudflare, but domain is valid
                log(`[DomainResolver] ✓ Resolved to: ${resolvedDomain}`);
                resolvedBaseUrl = resolvedDomain;
                return resolvedDomain;
            }
        } catch (e) {
            log(`[DomainResolver] ✗ ${domain} failed: ${e.message}`);
        }
    }

    // Fallback to env or first known domain
    const fallback = ENV_BASE_URL || KNOWN_DOMAINS[0];
    log(`[DomainResolver] ⚠ Using fallback: ${fallback}`);
    resolvedBaseUrl = fallback;
    return fallback;
}

/**
 * Build URL map with the resolved base URL
 */
function buildUrlMap(baseUrl) {
    return {
        'trending-series': { url: `${baseUrl}/it/browse/trending?type=tv`, type: 'tv', header: 'I titoli del momento', file: 'trending-series-stremio.json' },
        'novita-series': { url: `${baseUrl}/it/browse/latest?type=tv`, type: 'tv', header: 'Aggiunti di recente', file: 'novita-series-stremio.json' },
        'korean-series': { url: `${baseUrl}/it/archive?genre[]=26&type=tv`, type: 'tv', header: null, file: 'korean-series-stremio.json' },
        'trending-movies': { url: `${baseUrl}/it/browse/trending?type=movie`, type: 'movie', header: 'I titoli del momento', file: 'trending-movies-stremio.json' },
        'novita-movies': { url: `${baseUrl}/it/browse/latest?type=movie`, type: 'movie', header: 'Aggiunti di recente', file: 'novita-movies-stremio.json' },
        'korean-movies': { url: `${baseUrl}/it/archive?genre[]=26&type=movie`, type: 'movie', header: null, file: 'korean-movies-stremio.json' },
    };
}

async function scrapeCatalog(key, log = console.log) {
    // Resolve domain dynamically
    const baseUrl = await resolveCurrentDomain(log);
    const URL_MAP = buildUrlMap(baseUrl);

    const config = URL_MAP[key];
    if (!config) throw new Error(`Unknown catalog key: ${key}`);

    log(`[Scraper] Starting ${key} from ${config.url}`);
    const page = await getStealthPage();

    try {
        log(`[Scraper] Navigating...`);
        await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for at least one title to load (handles Cloudflare/Dynamic Loading)
        try {
            await page.waitForSelector('a[href*="/it/titles/"]', { timeout: 30000 });
        } catch (e) {
            log('[Scraper] Timed out waiting for titles. Possible Cloudflare block?');
            throw e;
        }

        // Scroll Logic
        log(`[Scraper] Scrolling to fetch all items...`);
        await page.evaluate(async () => {
            const distance = 1000;
            const delay = 800;
            let totalHeight = 0;
            let noChanges = 0;

            while (noChanges < 3) { // Stop after 3 attempts with no new height
                let lastHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                await new Promise(r => setTimeout(r, delay));
                let newHeight = document.body.scrollHeight;

                if (newHeight === lastHeight) {
                    noChanges++;
                } else {
                    noChanges = 0;
                    totalHeight = newHeight;
                }
            }
        });

        // Extract Titles
        log(`[Scraper] Extracting titles...`);
        const titles = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/it/titles/"]'));
            return Array.from(new Set(links.map(l => {
                const parts = l.href.split('/');
                const lastPart = parts[parts.length - 1]; // e.g. "2270-emily-in-paris"
                // Remove ID prefix if present
                const slug = lastPart.substring(lastPart.indexOf('-') + 1);
                return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            })));
        });

        log(`[Scraper] Found ${titles.length} titles. Processing enrichment...`);
        await page.close();

        // AI-powered title normalization for better TMDB matching
        log(`[Scraper] Normalizing titles with AI...`);
        const titleMap = await normalizeTitlesBatch(titles, log);
        log(`[Scraper] Normalized ${Object.keys(titleMap).length} titles.`);

        // Enrichment with TMDB
        const enriched = [];
        const db = getDatabase();
        const repo = config.type === 'movie' ? movieRepo : tvRepo;

        for (const rawTitle of titles) {
            // Use normalized title for lookup
            const title = titleMap[rawTitle] || rawTitle;

            // Check DB First (Fast)
            let meta = null;
            try {
                // Approximate match for speed
                const existing = db.prepare(`SELECT * FROM ${config.type}_metadata WHERE title LIKE ? LIMIT 1`).get(title);
                if (existing) {
                    meta = existing;
                }
            } catch (e) { }

            if (!meta) {
                // Fetch TMDB
                const tmdbRes = await fetchTMDB(title, config.type, () => { }); // Silence logs
                if (tmdbRes && tmdbRes.details) {
                    // Save to DB
                    // Use mapCommon to prepare full DB object
                    meta = mapCommon(tmdbRes.details, tmdbRes.details.credits?.crew, config.type);

                    try {
                        repo.save(meta);
                        log(`[Scraper] Saved to DB: ${meta.title}`);
                    } catch (e) {
                        log(`[Scraper] DB Save Error: ${e.message}`);
                    }
                }
            }

            if (meta) {
                enriched.push({
                    id: `tmdb:${meta.tmdb_id}`,
                    type: config.type === 'tv' ? 'series' : config.type,
                    name: meta.title || meta.name,
                    poster: meta.poster_path ? `https://image.tmdb.org/t/p/w500${meta.poster_path}` : null,
                    background: meta.background_path ? `https://image.tmdb.org/t/p/original${meta.background_path}` : null,
                    description: meta.description,
                    year: String(meta.release_year || meta.first_air_year || (meta.release_date || '').split('-')[0] || (meta.first_air_date || '').split('-')[0] || ''),
                    releaseInfo: String(meta.release_year || meta.first_air_year || (meta.release_date || '').split('-')[0] || (meta.first_air_date || '').split('-')[0] || ''),
                    imdbRating: meta.rating ? String(meta.rating) : undefined,
                    genres: meta.genres ? JSON.parse(meta.genres).map(g => g.name) : []
                });
            }
        }

        log(`[Scraper] Enriched ${enriched.length}/${titles.length} titles.`);

        // Write to JSON
        const outPath = path.join(__dirname, '../../', config.file);
        fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2));
        log(`[Scraper] Saved to ${config.file}`);

    } catch (err) {
        log(`[Scraper] ERROR: ${err.message}`);
        if (!page.isClosed()) await page.close();
    }
}

async function runAllScrapers(log = console.log) {
    // Resolve domain once at start
    const baseUrl = await resolveCurrentDomain(log);
    const URL_MAP = buildUrlMap(baseUrl);

    const keys = Object.keys(URL_MAP);
    for (const key of keys) {
        await scrapeCatalog(key, log);
    }
    await closeBrowser();
}

module.exports = { scrapeCatalog, runAllScrapers };
