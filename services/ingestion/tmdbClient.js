const { TMDB_API_KEY } = require('../../config/settings');
const { PROVIDER_CATALOG_MAP } = require('../../config/constants');
const collectionRepo = require('../../lib/db/repositories/collectionRepository');
const { getDatabase } = require('../../lib/db');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const ASIAN_COUNTRIES = [
    'CN', 'JP', 'KR', 'TH', 'VN', 'ID', 'MY', 'PH', 'SG', 'TW', 'HK', 'MO', 'KH', 'LA', 'MM', 'BN', 'TL', 'IN', 'PK', 'LK', 'BD', 'NP'
];

const EUROPEAN_COUNTRIES = [
    'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'TR', 'UA', 'GB', 'VA',
    'FO', 'GI', 'IM', 'GG', 'JE', 'AX'
];

function normalizeProviders(wp, details = {}) {
    const providerCatalogSet = new Set();
    const idSet = new Set();
    const out = { IT: {} };

    // Process TMDB Providers if available
    if (wp && wp.IT) {
        const k = 'flatrate';
        if (Array.isArray(wp.IT[k])) {
            wp.IT[k].forEach(p => {
                for (const entry of PROVIDER_CATALOG_MAP) {
                    let canonicalName = entry.name;
                    if (canonicalName.replace(/\s+/g, '') === 'Sky/NOW'.replace(/\s+/g, '')) {
                        canonicalName = 'Sky/NOW';
                    }

                    // Check if this provider matches the entry
                    const isMatch = (Array.isArray(entry.ids) && entry.ids.includes(p.provider_id)) ||
                        entry.name.toLowerCase() === (p.provider_name || '').trim().toLowerCase() ||
                        entry.originals.some(o => o.toLowerCase() === (p.provider_name || '').trim().toLowerCase());

                    if (isMatch) {
                        // Special handling for Netflix: Asia and Netflix: Europe
                        if (canonicalName === 'Netflix') {
                            providerCatalogSet.add('Netflix'); // Always add base Netflix
                            // Extract countries from details (production_countries for movies, origin_country for tv)
                            let originCountries = [];
                            if (details.production_countries && Array.isArray(details.production_countries)) {
                                originCountries = details.production_countries.map(c => c.iso_3166_1);
                            } else if (details.origin_country && Array.isArray(details.origin_country)) {
                                originCountries = details.origin_country;
                            }
                            const isAsian = originCountries.some(c => ASIAN_COUNTRIES.includes(c));
                            const isEuropean = originCountries.some(c => EUROPEAN_COUNTRIES.includes(c));

                            if (isAsian) {
                                providerCatalogSet.add('Netflix: Asia');
                            }
                            if (isEuropean) {
                                providerCatalogSet.add('Netflix: Europe');
                            }
                        } else {
                            providerCatalogSet.add(canonicalName);
                        }
                    }
                }
                if (p.provider_id) idSet.add(p.provider_id);
            });
            out.IT[k] = wp.IT[k];
        } else {
            out.IT[k] = [];
        }
    } else {
        out.IT['flatrate'] = [];
    }

    // Special Rule: If title contains "Drag Race" or "RuPaul", force WOW Presents Plus
    const title = (details.name || details.title || '').toLowerCase();
    if (title.includes('drag race') || title.includes('rupaul')) {
        providerCatalogSet.add('WOW Presents Plus');
    }

    return {
        providers: Array.from(providerCatalogSet).sort(),
        watch_providers: out,
        provider_catalog_names: Array.from(providerCatalogSet).sort(),
        provider_ids: Array.from(idSet).sort((a, b) => a - b)
    };
}

async function saveCollectionIfMissing(coll, log = console.log) {
    if (!coll || !coll.id) return;
    if (collectionRepo.exists(coll.id)) return;

    const url = `https://api.themoviedb.org/3/collection/${coll.id}?api_key=${TMDB_API_KEY}&language=it-IT`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Collection ${coll.id} ${res.status}`);
        const it = await res.json();
        collectionRepo.save(it.id, it.name || coll.name, it.overview || '', it.poster_path || coll.poster_path, it.backdrop_path || coll.backdrop_path, it.parts || coll.parts || []);
        log(`[Collection] Saved ${it.id} – ${it.name}`);
    } catch (e) {
        log(`[Collection] Failed ${coll.id}: ${e.message} – inserting bare`);
        collectionRepo.save(coll.id, coll.name, '', coll.poster_path, coll.backdrop_path, coll.parts || []);
    }
}

async function fetchTMDB(id, type, log = console.log) {
    const db = getDatabase();
    const cacheKey = `tmdb:${type}:${id}`;

    // Check cache
    try {
        const cached = db.prepare('SELECT data, timestamp FROM tmdb_cache WHERE key = ?').get(cacheKey);
        if (cached) {
            // Cache valid for 3 days
            if (Date.now() - cached.timestamp < 3 * 24 * 60 * 60 * 1000) {
                return JSON.parse(cached.data);
            }
        }
    } catch (e) { }

    const base = 'https://api.themoviedb.org/3';
    const url = `${base}/${type}/${id}?api_key=${TMDB_API_KEY}&language=it-IT&region=IT&append_to_response=credits,videos,images,keywords,external_ids,watch/providers,translations,alternative_titles`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!res.ok) {
            log(`[TMDB]  ERROR ${res.status} ${res.statusText} for ${id}`);
            return null;
        }
        const details = await res.json();
        const { providers, watch_providers } = normalizeProviders(details['watch/providers']?.results, details);
        details.providers = providers;
        details.watch_providers = watch_providers;
        if (details.belongs_to_collection?.id) await saveCollectionIfMissing(details.belongs_to_collection, log);
        log(`[TMDB]  OK    ${type} ${id} – ${details.title || details.name}`);

        const result = { details, actualType: type };

        // Save to cache
        try {
            db.prepare('INSERT OR REPLACE INTO tmdb_cache (key, data, timestamp) VALUES (?, ?, ?)').run(cacheKey, JSON.stringify(result), Date.now());
        } catch (e) { }

        return result;
    } catch (e) {
        log(`[TMDB]  EXC   ${type} ${id}: ${e.message}`);
        return null;
    }
}

async function fetchSeason(tvId, seasonNumber, log = console.log) {
    const db = getDatabase();
    // Cache key for season
    const cacheKey = `tmdb:season:${tvId}:${seasonNumber}`;

    // Check cache
    try {
        const cached = db.prepare('SELECT data, timestamp FROM tmdb_cache WHERE key = ?').get(cacheKey);
        if (cached) {
            // Cache valid for 3 days
            if (Date.now() - cached.timestamp < 3 * 24 * 60 * 60 * 1000) {
                return JSON.parse(cached.data);
            }
        }
    } catch (e) { }

    const base = 'https://api.themoviedb.org/3';
    const url = `${base}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=it-IT`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            log(`[TMDB]  ERROR ${res.status} fetching season ${seasonNumber} for ${tvId}`);
            return null;
        }
        const data = await res.json();

        // Cache it
        try {
            db.prepare('INSERT OR REPLACE INTO tmdb_cache (key, data, timestamp) VALUES (?, ?, ?)').run(cacheKey, JSON.stringify(data), Date.now());
        } catch (e) { }

        return data;
    } catch (e) {
        log(`[TMDB]  EXC fetching season ${seasonNumber} for ${tvId}: ${e.message}`);
        return null;
    }
}

async function syncCollectionsImages() {
    console.log('[TMDB] Syncing collection images (placeholder)...');
}

module.exports = { fetchTMDB, normalizeProviders, saveCollectionIfMissing, syncCollectionsImages, fetchSeason };
