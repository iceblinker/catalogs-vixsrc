const movieRepo = require('../lib/db/repositories/movieRepository');
const tvRepo = require('../lib/db/repositories/tvRepository');
const { toMetaPreview, fullMeta } = require('./metaService');
const { KEYWORD_CATALOGS, PROVIDER_CATALOG_MAP, SPECIAL_GENRE_CONFIG, STRICT_EXCLUDED_GENRES, EXCLUDED_GENRES, ITALIAN_TO_ENGLISH_GENRES, ASIAN_COUNTRIES, EUROPEAN_COUNTRIES } = require('../config/constants');
const { KEYWORD_CATALOG, CACHE_MOVIE_COLLECTIONS, CACHE_SERIES_COLLECTIONS, CACHE_NUOVI_EPISODI, CACHE_NOVITA_MOVIES, CACHE_TRENDING_MOVIES, CACHE_NOVITA_SERIES, CACHE_TRENDING_SERIES } = require('../config/settings');
const path = require('path');
const fs = require('fs');
const cache = require('../lib/cache');
const chromaClient = require('./search/chromaClient');

// Toggle for Semantic Search
const AI_SEARCH_ENABLED = process.env.AI_SEARCH_ENABLED === 'true';

const log = (msg) => console.log(msg);

async function getCatalogItems(type, id, extra) {
    const skip = parseInt(extra.skip || '0', 10);
    let genre = extra.genre;
    if (genre === 'Cinema TV') genre = 'televisione film';
    if (genre === 'Drama') genre = 'Dramma';
    const search = extra.search;

    // --- Collection Catalogs ---
    if (id === 'vixsrc_movie_collections') {
        const cachePath = CACHE_MOVIE_COLLECTIONS;
        if (!fs.existsSync(cachePath)) throw new Error('Cache not ready');
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        let metas = Array.isArray(cache.metas) ? cache.metas : (Array.isArray(cache.collections) ? cache.collections : []);

        if (genre) {
            if (genre === 'Recenti') {
                metas = metas.slice().sort((a, b) => {
                    const aDate = a.latestReleaseDate || new Date(a.release_date || 0).getTime();
                    const bDate = b.latestReleaseDate || new Date(b.release_date || 0).getTime();
                    return bDate - aDate;
                });
            } else {
                // Map Italian genre to English if needed
                const filterGenre = ITALIAN_TO_ENGLISH_GENRES[genre] || genre;
                metas = metas.filter(m => Array.isArray(m.genres) && (m.genres.includes(filterGenre) || m.genres.includes(genre)));
                metas = metas.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            }
        } else {
            metas = metas.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }
        return { metas: metas.slice(skip, skip + 100) };
    }

    if (id === 'vixsrc_series_collections') {
        const cachePath = CACHE_SERIES_COLLECTIONS;
        if (!fs.existsSync(cachePath)) throw new Error('Cache not ready');
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        let metas = Array.isArray(cache.metas) ? cache.metas : (Array.isArray(cache.collections) ? cache.collections : []);
        metas = metas.filter(m => m.type === 'series');
        if (genre) {
            if (genre === 'Recenti') {
                metas = metas.slice().sort((a, b) => {
                    const aDate = new Date(a.last_air_date || a.release_date || 0).getTime();
                    const bDate = new Date(b.last_air_date || b.release_date || 0).getTime();
                    return bDate - aDate;
                });
            } else {
                // Map Italian genre to English if needed
                const filterGenre = ITALIAN_TO_ENGLISH_GENRES[genre] || genre;
                metas = metas.filter(m => Array.isArray(m.genres) && (m.genres.includes(filterGenre) || m.genres.includes(genre)));
                metas = metas.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            }
        } else {
            metas = metas.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }
        return { metas: metas.slice(skip, skip + 100) };
    }

    // --- Collection Items ---
    if (id === 'vixsrc_collection_items') {
        const collId = parseInt(extra.collection_id, 10);
        if (!collId) throw new Error('collection_id required');

        const movies = movieRepo.getByCollectionId(collId, 100, skip);
        const series = tvRepo.getByCollectionId(collId, 100, skip);

        const mixed = [...movies, ...series]
            .sort((a, b) => ((b.release_date || b.last_air_date) || '').localeCompare((a.release_date || a.last_air_date) || ''))
            .slice(0, 100);
        const metas = mixed.map(r => toMetaPreview(fullMeta(r, r.actual_type || (r.release_date ? 'movie' : 'series'))));
        return { metas };
    }

    // --- StreamingUnity Catalog ---
    if (id === 'vixsrc_streamingunity_movie' || id === 'vixsrc_streamingunity_series') {
        const repo = type === 'movie' ? movieRepo : tvRepo;
        const whereParts = ['catalog_names LIKE ?'];
        const params = ['%streamingunity%'];

        if (search) {
            whereParts.push('(title LIKE ? OR name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        // Basic genre filtering if needed (though SU items might not have standard genres populated yet)
        if (genre) {
            whereParts.push('genres LIKE ?');
            params.push(`%${genre}%`);
        }

        const whereClause = whereParts.join(' AND ');
        const orderBy = type === 'movie' ? 'release_date DESC' : 'last_air_date DESC';

        const rows = repo.find(whereClause, params, 100, skip, orderBy);
        const metas = rows.map(r => toMetaPreview(fullMeta(r, type)));
        return { metas };
    }

    // --- Main / Provider / Keyword Catalogs ---
    const repo = type === 'movie' ? movieRepo : tvRepo;
    const whereParts = ['1=1'];
    const params = [];

    // Keyword Catalog
    // Keyword Catalog (Dynamic)
    const keywordMatch = id.match(/^vixsrc_(.+?)_(movies|series)$/);
    if (keywordMatch && KEYWORD_CATALOGS[keywordMatch[1]]) {
        const key = keywordMatch[1];
        const cfg = KEYWORD_CATALOGS[key];

        const excludedGenres = EXCLUDED_GENRES;

        if (key === 'animal_horror') {
            const horrorVariants = ['horror'];
            whereParts.push('rating >= ?');
            params.push(cfg.minRating);
            whereParts.push('(' + cfg.keywords.map(() => 'keywords LIKE ?').join(' OR ') + ')');
            params.push(...cfg.keywords.map(k => `%${k}%`));
            whereParts.push('(' + horrorVariants.map(() => 'genres LIKE ?').join(' OR ') + ')');
            params.push(...horrorVariants.map(g => `%${g}%`));
            whereParts.push('(' + excludedGenres.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
            params.push(...excludedGenres.map(g => `%${g}%`));
        } else if (key === 'virus_catalog') {
            const extraExclusions = ['famiglia', 'commedia', 'musica', 'romance', 'romantico'];
            const allExclusions = excludedGenres.concat(extraExclusions);
            const excludedKeywords = ['alzheimers', 'parkinsons', 'aids', 'hiv'];
            whereParts.push('rating >= ?');
            params.push(cfg.minRating);
            whereParts.push('(' + cfg.keywords.map(() => 'keywords LIKE ?').join(' OR ') + ')');
            params.push(...cfg.keywords.map(k => `%${k}%`));
            whereParts.push('(' + allExclusions.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
            params.push(...allExclusions.map(g => `%${g}%`));
            whereParts.push('(' + excludedKeywords.map(() => 'keywords NOT LIKE ?').join(' AND ') + ')');
            params.push(...excludedKeywords.map(k => `%${k}%`));
        } else if (key === 'supernatural_catalog') {
            const horrorVariants = ['horror', 'mystery', 'thriller']; // Allow broader range for supernatural
            whereParts.push('rating >= ?');
            params.push(cfg.minRating);
            whereParts.push('(' + cfg.keywords.map(() => 'keywords LIKE ?').join(' OR ') + ')');
            params.push(...cfg.keywords.map(k => `%${k}%`));
            // Supernatural is often horror, but can be mystery/thriller.
            // Using logic similar to animal horror but maybe less strict on "Horror" required?
            // User requested: "Supernatural" catalog.
            // Default logic:
            whereParts.push('(' + excludedGenres.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
            params.push(...excludedGenres.map(g => `%${g}%`));
        } else {
            whereParts.push('rating >= ?');
            params.push(cfg.minRating);
            whereParts.push('(' + cfg.keywords.map(() => 'keywords LIKE ?').join(' OR ') + ')');
            params.push(...cfg.keywords.map(k => `%${k}%`));
            whereParts.push('(' + excludedGenres.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
            params.push(...excludedGenres.map(g => `%${g}%`));
        }
    }

    // Provider Catalog
    else if (id === 'vixsrc_provider_movie' || id === 'vixsrc_provider_series') {
        let providerName = extra.provider || '';
        const genreFilter = genre;

        // If no provider specified, return empty or default behavior (though manifest requires it)
        if (!providerName) return { metas: [] };

        // Normalize provider name
        providerName = providerName.trim();
        let countryFilter = null;

        // Special mappings
        if (providerName === 'Netflix: Europe') {
            providerName = 'Netflix';
            countryFilter = ['Italy', 'France', 'Germany', 'Spain', 'United Kingdom', 'Ireland', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland', 'Luxembourg', 'Liechtenstein', 'Monaco', 'Andorra', 'San Marino', 'Vatican City', 'Greece', 'Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia', 'Serbia', 'Montenegro', 'Bosnia and Herzegovina', 'North Macedonia', 'Albania', 'Estonia', 'Latvia', 'Lithuania', 'Ukraine', 'Belarus', 'Moldova', 'Russia', 'Turkey'];
        } else if (providerName === 'Netflix: Asia') {
            providerName = 'Netflix';
            countryFilter = ['China', 'Japan', 'South Korea', 'North Korea', 'Taiwan', 'Hong Kong', 'Macau', 'Singapore', 'Malaysia', 'Indonesia', 'Philippines', 'Thailand', 'Vietnam', 'Cambodia', 'Laos', 'Myanmar', 'Brunei', 'Mongolia'];
        } else if (providerName === 'Amazon Prime') {
            providerName = 'Amazon Prime Video';
        } else if (providerName === 'Sky/NOW') {
            providerName = 'Sky / NOW';
        }

        // Find provider entry
        const providerEntry = PROVIDER_CATALOG_MAP.find(p => p.name.toLowerCase() === providerName.toLowerCase() || (p.originals && p.originals.map(o => o.toLowerCase()).includes(providerName.toLowerCase())));

        if (!providerEntry) return { metas: [] };

        // Build Provider WHERE clause
        // Build Provider WHERE clause using REGEXP for performance
        let providerWhereParts = [];

        if (providerEntry.ids.length > 0) {
            const idsRegex = `"provider_id":(${providerEntry.ids.join('|')})\\b`;
            providerWhereParts.push(`watch_providers REGEXP '${idsRegex}'`);
        }

        if (providerEntry.originals.length > 0) {
            const namesRegex = `(${providerEntry.originals.map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
            providerWhereParts.push(`providers REGEXP '${namesRegex}'`);
        }

        if (providerWhereParts.length > 0) {
            whereParts.push(`(${providerWhereParts.join(' OR ')})`);
        } else {
            // Fallback if no specific IDs or names (shouldn't happen based on entry check)
            whereParts.push('1=0');
        }

        if (countryFilter) {
            // Optimize country filter with REGEXP
            // Matches "Country" in the JSON array
            const countriesRegex = `"${countryFilter.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}"`;
            whereParts.push(`countries REGEXP '${countriesRegex}'`);
        }

        // Apply Genre / Special Genre Logic
        if (genreFilter) {
            if (SPECIAL_GENRE_CONFIG[genreFilter]) {
                const cfg = SPECIAL_GENRE_CONFIG[genreFilter];

                // Enforce Valid Types if specified
                if (cfg.validTypes && !cfg.validTypes.includes(type)) {
                    return { metas: [] };
                }

                whereParts.push('rating >= ?');
                params.push(cfg.minRating);
                whereParts.push('(' + cfg.keywords.map(() => 'keywords LIKE ?').join(' OR ') + ')');
                params.push(...cfg.keywords.map(k => `%${k}%`));

                if (cfg.horrorVariants && type === 'movie') {
                    whereParts.push('(' + cfg.horrorVariants.map(() => 'genres LIKE ?').join(' OR ') + ')');
                    params.push(...cfg.horrorVariants.map(g => `%${g}%`));
                }

                if (genreFilter === 'Virus') {
                    const allExclusions = EXCLUDED_GENRES.concat(cfg.extraExclusions || []);
                    whereParts.push('(' + allExclusions.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
                    params.push(...allExclusions.map(g => `%${g}%`));
                    if (cfg.excludedKeywords) {
                        whereParts.push('(' + cfg.excludedKeywords.map(() => 'keywords NOT LIKE ?').join(' AND ') + ')');
                        params.push(...cfg.excludedKeywords.map(k => `%${k}%`));
                    }
                } else {
                    whereParts.push('(' + EXCLUDED_GENRES.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
                    params.push(...EXCLUDED_GENRES.map(g => `%${g}%`));
                }
            }

            else {
                // Standard Genre
                whereParts.push('genres LIKE ?');
                params.push(`%${genreFilter}%`);

                // Exclude strict genres unless selected
                if (!STRICT_EXCLUDED_GENRES.map(g => g.toLowerCase()).includes(genreFilter.toLowerCase())) {
                    whereParts.push('(' + STRICT_EXCLUDED_GENRES.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
                    params.push(...STRICT_EXCLUDED_GENRES.map(g => `%${g}%`));
                }
            }
        } else {
            // No genre selected, apply default exclusions
            whereParts.push('(' + STRICT_EXCLUDED_GENRES.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
            params.push(...STRICT_EXCLUDED_GENRES.map(g => `%${g}%`));
        }
    }
    // Main Catalog
    else {
        // Special Genres (Novità, Trending, Nuovi Episodi)
        if (genre === 'Nuovi Episodi' && type === 'series') {
            const cachePath = CACHE_NUOVI_EPISODI;
            if (fs.existsSync(cachePath)) {
                const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                const ids = cache.ids || [];
                const pageIds = ids.slice(skip, skip + 100);
                const foundRows = pageIds.map(tid => tvRepo.getById(Number(tid))).filter(Boolean);
                const metas = foundRows.map(r => toMetaPreview(fullMeta(r, 'series')));
                return { metas };
            }
        }
        if (['Novità', 'Trending'].includes(genre)) {
            let cacheFile;
            if (genre === 'Novità') {
                cacheFile = type === 'movie' ? CACHE_NOVITA_MOVIES : CACHE_NOVITA_SERIES;
            } else {
                cacheFile = type === 'movie' ? CACHE_TRENDING_MOVIES : CACHE_TRENDING_SERIES;
            }

            if (fs.existsSync(cacheFile)) {
                const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                const metas = (Array.isArray(cached) ? cached : (cached.metas || [])).slice(skip, skip + 100);
                return { metas };
            }
        }


        if (genre === 'Asian Drama') {
            const countriesRegex = `"${ASIAN_COUNTRIES.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}"`;
            whereParts.push(`countries REGEXP '${countriesRegex}'`);
        }

        else if (genre === 'European Drama') {
            const countriesRegex = `"${EUROPEAN_COUNTRIES.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}"`;
            whereParts.push(`countries REGEXP '${countriesRegex}'`);
        }

        else if (genre === 'Korean') {
            // Filter strictly for South Korea (KR). 
            // In DB, countries is typically: ["KR","CN"] etc.
            // Using REGEXP to match "KR" or "South Korea" safely inside JSON string
            whereParts.push(`countries REGEXP '"(KR|South Korea)"'`);
        }

        // Standard Genre Filter
        else if (genre) {
            // Map display name to internal key if needed (e.g. 'Animal Horror' -> 'animal_horror')
            // But SPECIAL_GENRE_CONFIG uses display names as keys, so we check that directly.
            // However, the user's original code had a map. Let's respect the map if the config key lookup fails, 
            // OR if the config keys are actually the mapped values (which they are NOT in constants.js).
            // In constants.js: SPECIAL_GENRE_CONFIG['Animal Horror'] exists.

            if (SPECIAL_GENRE_CONFIG[genre]) {
                const cfg = SPECIAL_GENRE_CONFIG[genre];
                whereParts.push('rating >= ?');
                params.push(cfg.minRating);
                whereParts.push('(' + cfg.keywords.map(() => 'keywords LIKE ?').join(' OR ') + ')');
                params.push(...cfg.keywords.map(k => `%${k}%`));

                if (cfg.horrorVariants && type === 'movie') {
                    whereParts.push('(' + cfg.horrorVariants.map(() => 'genres LIKE ?').join(' OR ') + ')');
                    params.push(...cfg.horrorVariants.map(g => `%${g}%`));
                }

                if (genre === 'Virus') {
                    const allExclusions = EXCLUDED_GENRES.concat(cfg.extraExclusions || []);
                    whereParts.push('(' + allExclusions.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
                    params.push(...allExclusions.map(g => `%${g}%`));
                    if (cfg.excludedKeywords) {
                        whereParts.push('(' + cfg.excludedKeywords.map(() => 'keywords NOT LIKE ?').join(' AND ') + ')');
                        params.push(...cfg.excludedKeywords.map(k => `%${k}%`));
                    }
                } else {
                    // Standard exclusions for other special genres
                    whereParts.push('(' + EXCLUDED_GENRES.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
                    params.push(...EXCLUDED_GENRES.map(g => `%${g}%`));
                }
            } else {
                whereParts.push('genres LIKE ?');
                params.push(`%${genre}%`);
            }
        }

        // Exclude strict genres
        if (!genre || !STRICT_EXCLUDED_GENRES.map(g => g.toLowerCase()).includes(genre.toLowerCase())) {
            whereParts.push('(' + STRICT_EXCLUDED_GENRES.map(() => 'genres NOT LIKE ?').join(' AND ') + ')');
            params.push(...STRICT_EXCLUDED_GENRES.map(g => `%${g}%`));
        }
    }

    // Search
    if (search) {
        let semanticIds = [];
        if (AI_SEARCH_ENABLED) {
            try {
                // Try Semantic Search first
                const searchResults = await chromaClient.search(search, 20); // Top 20 relevant
                if (searchResults && searchResults.length > 0) {
                    semanticIds = searchResults.map(r => r.id);
                    log(`[Search] Semantic found ${semanticIds.length} matches for "${search}"`);
                }
            } catch (e) {
                log(`[Search] Semantic failed: ${e.message}`);
            }
        }

        if (semanticIds.length > 0) {
            // Priority: Semantic IDs first. 
            // We construct a specific WHERE order.
            // SQLite doesn't have ORDER BY FIELD easily, but we can do WHERE id IN (...)
            whereParts.push(`tmdb_id IN (${semanticIds.join(',')})`);
            // We might want to mix or solely use semantic. 
            // For now, let's RESTRICT to semantic if found to avoid showing "text match" junk over "meaning match" gold.
            // Or use OR? Users usually prefer exact text matches (Spiderman -> Spiderman) + semantic (Hero -> Spiderman).
            // Let's do: (Title LIKE %search%) OR (ID IN semantic)

            // Re-write the logic slightly:
            // Remove the previous push if we want hybrid. 
            // Actually, the previous block was `whereParts.push('(title LIKE...)'`.
            // Let's replace that block with this hybrid logic.

            // FIX: We need to pop the previous check if we want to replace it, but we can just use an if/else block in the Replacement.
        } else {
            whereParts.push('(title LIKE ? OR name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
    } else {
        // Smart Filter: Hide content with very low votes (junk/spam) unless searching
        // Only apply this to the general catalog queries where we want "quality"
        if (!id.includes('provider') && !id.includes('keyword')) {
            whereParts.push('vote_count >= ?');
            params.push(5);
        }
    }

    const whereClause = whereParts.join(' AND ');

    // Smart Sort: Prioritize New Releases, but break ties/near-dates with Popularity
    const orderBy = type === 'movie' ? 'release_date DESC, popularity DESC' : 'last_air_date DESC, popularity DESC';

    // Cache Key for DB Queries
    const cacheKey = `catalog:${type}:${id}:${JSON.stringify(extra)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return { metas: cached };

    const rows = repo.find(whereClause, params, 100, skip, orderBy);
    const metas = rows.map(r => toMetaPreview(fullMeta(r, type)));

    // Cache for 1 hour
    await cache.set(cacheKey, metas, 3600);

    return { metas };
}

module.exports = { getCatalogItems };
