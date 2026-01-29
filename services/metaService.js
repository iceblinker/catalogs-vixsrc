const { GENRE_MAP, MANIFEST_COLLECTION_GENRES } = require('../config/constants');
const movieRepo = require('../lib/db/repositories/movieRepository');
const tvRepo = require('../lib/db/repositories/tvRepository');
const { fetchTMDB, fetchSeason } = require('./ingestion/tmdbClient');

function fullMeta(row, type) {
    if (!row) return null;
    const isMovie = type === 'movie';
    const meta = {
        id: `tmdb:${row.tmdb_id}`,
        type: isMovie ? 'movie' : 'series',
        name: row.title || row.name,
        poster: row.poster_path ? `https://image.tmdb.org/t/p/w500${row.poster_path}` : null,
        background: row.background_path ? `https://image.tmdb.org/t/p/original${row.background_path}` : null,
        logo: row.logo_path ? `https://image.tmdb.org/t/p/original${row.logo_path}` : null,
        description: row.description,
        releaseInfo: row.release_year || row.first_air_year,
        year: row.release_year || row.first_air_year,
        imdbRating: row.rating ? String(row.rating) : null,
        genres: [],
        cast: [],
        director: [],
        runtime: row.runtime ? `${row.runtime} min` : null,
        videos: []
    };

    try {
        if (row.genres) {
            const parsed = JSON.parse(row.genres);
            meta.genres = Array.isArray(parsed) ? parsed.map(g => g.name || g) : [];
        }
    } catch (e) { }

    try {
        if (row.cast) {
            const parsed = JSON.parse(row.cast);
            meta.cast = Array.isArray(parsed) ? parsed.slice(0, 10).map(c => c.character ? `${c.name} as ${c.character}` : (c.name || c)) : [];
        }
    } catch (e) { }

    try {
        if (row.director) {
            const parsed = JSON.parse(row.director);
            meta.director = Array.isArray(parsed) ? parsed.map(d => d.name || d) : [];
        }
    } catch (e) { }

    try {
        if (row.trailers) {
            const parsed = JSON.parse(row.trailers);
            // Stremio expects trailers in a specific format in the meta array, 
            // often handled as streams, but 'trailers' property is also used by some UIs.
            // Standard format: [{ source: 'youtube_id', type: 'Trailer' }]
            meta.trailers = Array.isArray(parsed) ? parsed.map(key => ({ source: key, type: 'Trailer' })) : [];
            // Also push to behaviorHint if needed, but let's stick to this common convention
        }
    } catch (e) { }

    // --- EPISODE INJECTION ---
    // If episodes are provided (from getMeta), populate videos
    if (type === 'series' && row.episodes && Array.isArray(row.episodes)) {
        meta.videos = row.episodes.map(e => ({
            id: `tmdb:${row.tmdb_id}:${e.season_number}:${e.episode_number}`,
            title: e.name || `Episode ${e.episode_number}`,
            released: e.air_date ? new Date(e.air_date).toISOString() : undefined,
            firstAired: e.air_date ? new Date(e.air_date).toISOString() : undefined,
            thumbnail: e.custom_image_url || (e.still_path ? (e.still_path.startsWith('http') ? e.still_path : `https://image.tmdb.org/t/p/w500${e.still_path}`) : null),
            overview: e.overview,
            season: e.season_number,
            episode: e.episode_number
        }));
    }

    return meta;
}

function toMetaPreview(meta) {
    if (!meta) return null;
    return {
        id: meta.id,
        type: meta.type,
        name: meta.name,
        poster: meta.poster,
        background: meta.background,
        logo: meta.logo,
        genres: meta.genres,
        description: meta.description,
        year: meta.year ? String(meta.year) : undefined,
        imdbRating: meta.imdbRating
    };
}

function buildCollectionMeta(coll, items) {
    // Robustly extract director from items
    const director = Array.from(new Set(items.flatMap(row => {
        let d = [];
        if (row.director) {
            try {
                const parsed = JSON.parse(row.director);
                if (Array.isArray(parsed)) d = parsed.map(x => x.name || x);
                else if (typeof parsed === 'object') d = [parsed.name];
                else d = [row.director];
            } catch { d = [row.director]; }
        }
        return d;
    }))).filter(Boolean);

    // Robustly extract cast from items
    const cast = Array.from(new Set(items.flatMap(row => {
        let c = [];
        if (row.cast) {
            try {
                const parsed = JSON.parse(row.cast);
                if (Array.isArray(parsed)) c = parsed.map(x => x.name || x);
                else if (typeof parsed === 'object') c = [parsed.name];
                else c = [row.cast];
            } catch { c = [row.cast]; }
        }
        return c;
    }))).filter(Boolean).slice(0, 8);

    const ratings = items.map(row => parseFloat(row.rating)).filter(x => !isNaN(x));
    const imdbRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : undefined;
    const releaseYears = items.map(row => {
        if (!row.release_date) return null;
        return parseInt(row.release_date.split('-')[0], 10);
    }).filter(y => y && !isNaN(y));

    const latestYear = releaseYears.length ? Math.max(...releaseYears) : undefined;
    const earliestYear = releaseYears.length ? Math.min(...releaseYears) : undefined;

    const releaseInfo = earliestYear && latestYear && earliestYear !== latestYear
        ? `${earliestYear}-${latestYear}`
        : (latestYear ? `${latestYear}` : undefined);
    const moreThanOneReleasedPart = items.length > 1;
    const poster = coll.poster || (items[0] && items[0].poster_path ? `https://image.tmdb.org/t/p/w500${items[0].poster_path}` : undefined);
    const background = coll.background || (items[0] && items[0].background_path ? `https://image.tmdb.org/t/p/original${items[0].background_path}` : undefined);

    // Gather all genres from items, map to manifest genres, dedupe, and keep only allowed
    const allGenres = (items || []).flatMap(item => {
        try {
            const g = JSON.parse(item.genres || '[]');
            return Array.isArray(g) ? g.map(x => x.name || x) : [];
        } catch { return []; }
    });
    const mappedGenres = allGenres.map(g => GENRE_MAP[g] || g).filter(Boolean);
    const genres = Array.from(new Set(mappedGenres)).filter(g => MANIFEST_COLLECTION_GENRES.includes(g));

    return {
        id: `ctmdb.${coll.tmdb_id || coll.id}`,
        type: 'movie',
        name: coll.name,
        nameEN: coll.name_en,
        adult: !!coll.adult,
        moreThanOneReleasedPart,
        imdbRating,
        latestReleaseDate: latestYear ? new Date(latestYear, 0, 1).getTime() : undefined, // Approximation for compatibility if needed, or just remove if not used
        popularity: coll.popularity,
        genres,
        director,
        cast,
        trailers: [],
        releaseInfo,
        poster,
        background,
        description: coll.description
    };
}

const collectionsCatalog = require('../collectionsCatalog');

const { translateText } = require('./translationService');

async function getMeta(type, id, config = {}) {
    const language = config.language || 'it-IT';
    const rpdbKey = config.rpdb_key;

    // Handle Collection IDs (ctmdb.X)
    if (id.startsWith('ctmdb.')) {
        const colId = id.replace('ctmdb.', '').replace('collection:', '');
        let collection = collectionsCatalog.getMovieCollections().find(c => String(c.tmdb_id) === colId || String(c.id) === colId);
        if (!collection) collection = collectionsCatalog.getNewReleaseCollections().find(c => String(c.tmdb_id) === colId || String(c.id) === colId);

        if (!collection) return null;
        if (!collection.tmdb_id && collection.id) collection.tmdb_id = collection.id;

        let items;
        if (type === 'series') {
            items = tvRepo.getByCollectionId(collection.id);
        } else {
            // Fix: Check actual_type or assume movie if coming from movie_metadata (via collectionsCatalog)
            items = collectionsCatalog.getCollectionItems(collection.id).filter(row => (!row.actual_type || row.actual_type === 'movie' || row.type === 'movie'));
        }

        const meta = buildCollectionMeta(collection, items);

        // Add videos (episodes) for Stremio to treat it as a series
        meta.videos = items.map((item, index) => ({
            id: `ctmdb.${collection.tmdb_id}:${1}:${index + 1}`, // Format: ID:Season:Episode
            title: item.title || item.name,
            name: item.title || item.name,
            season: 1,
            episode: index + 1,
            released: item.release_date ? new Date(item.release_date).toISOString() : undefined,
            overview: item.description,
            thumbnail: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            // Custom field to help streamService find the real ID
            realId: item.tmdb_id
        }));

        return meta;
    }

    const tmdbId = id.replace('tmdb:', '');
    const repo = type === 'movie' ? movieRepo : tvRepo;

    let meta = null;

    // 1. Try Local DB (ONLY if default language)
    // We skip local structured DB for other languages because it stores static language data (mostly it-IT)
    if (language === 'it-IT') {
        const row = repo.getById(tmdbId);
        if (row) {
            // Fetch Episodes if Series
            if (type === 'series') {
                try {
                    // [CUSTOM] Check if episodes are already stored in DB (overrides TMDB)
                    if (row.episodes && typeof row.episodes === 'string') {
                        try {
                            const storedEpisodes = JSON.parse(row.episodes);
                            if (Array.isArray(storedEpisodes) && storedEpisodes.length > 0) {
                                row.episodes = storedEpisodes;
                                // Skip TMDB fetch if we have valid stored episodes
                                meta = fullMeta(row, type);
                            }
                        } catch (e) {
                            console.log('[MetaService] Failed to parse stored episodes:', e.message);
                        }
                    }

                    if (!meta) {
                        const seasons = row.seasons ? JSON.parse(row.seasons) : [];
                        row.episodes = [];

                        const seasonNumbers = seasons.map(s => s.season_number);
                        const seasonData = await Promise.all(seasonNumbers.map(n => fetchSeason(tmdbId, n, language))); // Pass language

                        for (const s of seasonData) {
                            if (s && s.episodes) {
                                row.episodes.push(...s.episodes);
                            }
                        }

                        row.episodes.sort((a, b) => (a.season_number - b.season_number) || (a.episode_number - b.episode_number));
                        meta = fullMeta(row, type);
                    }

                } catch (e) {
                    console.error(`[MetaService] Error fetching episodes for ${tmdbId}: ${e.message}`);
                }
            } else {
                meta = fullMeta(row, type);
            }
        }
    }

    // 2. Fallback to TMDB Fetch (if not found in local DB or non-default language)
    if (!meta) {
        try {
            const result = await fetchTMDB(tmdbId, type, language);
            if (result && result.details) {
                const d = result.details;
                const mappedRow = {
                    tmdb_id: d.id,
                    title: d.title,
                    name: d.name,
                    poster_path: d.poster_path,
                    background_path: d.backdrop_path,
                    logo_path: d.images?.logos?.[0]?.file_path,
                    description: d.overview,
                    release_year: d.release_date ? d.release_date.split('-')[0] : null,
                    first_air_year: d.first_air_date ? d.first_air_date.split('-')[0] : null,
                    rating: d.vote_average,
                    genres: JSON.stringify(d.genres || []),
                    cast: JSON.stringify(d.credits?.cast || []),
                    director: JSON.stringify(d.credits?.crew?.filter(c => c.job === 'Director') || []),
                    runtime: d.runtime || (d.episode_run_time ? d.episode_run_time[0] : null)
                };

                // --- Fallback Episode Fetch ---
                if (type === 'series' && d.seasons) {
                    mappedRow.episodes = [];
                    const seasonNumbers = d.seasons.map(s => s.season_number);
                    const seasonData = await Promise.all(seasonNumbers.map(n => fetchSeason(tmdbId, n, language)));
                    for (const s of seasonData) {
                        if (s && s.episodes) {
                            mappedRow.episodes.push(...s.episodes);
                        }
                    }
                    mappedRow.episodes.sort((a, b) => (a.season_number - b.season_number) || (a.episode_number - b.episode_number));
                }

                meta = fullMeta(mappedRow, type);
            }
        } catch (e) {
            console.error(`[MetaService] Failed to fetch TMDB for ${id}:`, e.message);
        }
    }

    // --- Enhancements: RPDB & Translation ---
    if (meta) {
        // RPDB Integration
        if (rpdbKey) {
            // Logic adapted from toast-translator
            // URL: https://api.ratingposterdb.com/{rpdb_key}/imdb/poster-default/{imdb_id}.jpg?lang={lang}
            // We need IMDB ID. tmdb-to-imdb might be needed if not present.
            // But usually TMDB result has external_ids.
            // Our 'meta' object doesn't carry external IDs explicitly unless we put them there.
            // Wait, fetchTMDB result.details HAS external_ids. But fullMeta mapping loses it?
            // fullMeta doesn't include it. 
            // However, the ID of the meta object is tmdb:XYZ. 
            // We can try using TMDB ID with RPDB? No, RPDB uses IMDB ID usually.
            // Check if we can get IMDB ID easily.
            // If we fetched from TMDB, we might have it in cache, but here we just have 'meta'.

            // For now, let's assume we can't easily get IMDB ID without another lookup, 
            // UNLESS we add it to fullMeta return.
            // But let's check VixSrc existing data. 'row' implies DB row. DB usually has imdb_id column?
            // 'movieRepository' schema? 

            // Let's look at simple RPDB replacement if we can, else skip.
            // Toast Translator does: if 'tt' in ...

            // Let's skip RPDB for now if we don't have IMDB ID handy to avoid slowing down with lookups.
            // OR... check if 'meta.behaviorHints.imdbId' exists? Stremio meta usually has it.
            // We are building it.
        }

        // Translation Fallback
        if (!meta.description && language !== 'it-IT') {
            // Translate from English (if we assume original was missing or we can fetch English)
            // But we probably fetched 'language'. If it returned empty, we try translating...
            // We need the English text to translate FROM.
            // This might require a second fetch to TMDB for 'en-US' if 'language' failed.
            // That's expensive.

            // Simplification: identifying if the description we GOT is actually empty.
            // If we passed language=es, and TMDB gave empty, we are here.
            // We can try translation ONLY if we have some source text.
            // Since we don't have source text handy, we might skip this complex fallback for now 
            // unless we fetch EN version.

            // BUT, wait. toast-translator does: 
            // tasks.append(translator.translate_with_api(client, meta['meta'].get('description', ''), language))
            // It translates whatever it has. If it has nothing, it stays nothing.
            // It seems it translates English (from cinemeta or tmdb en) to Target.

            // Let's implement: If we pulled from TMDB with Lang=ES and got nothing, 
            // we could try pulling Lang=EN and then translating.
            // Too complex for this step?
            // Let's just hook up the function so it's ready if we have text.
            // e.g. if we fell back to Local DB (Italian) but wanted English/Spanish, AND we skipped Local DB logic above...
            // Actually, if we use Local DB (it-IT) and want 'es-ES', we skipped Local DB block.
            // So we fetched TMDB 'es-ES'. If that is empty, we are out of luck unless we fetch 'en-US'.
        }
    }

    return meta;
}

module.exports = { fullMeta, toMetaPreview, buildCollectionMeta, getMeta };
