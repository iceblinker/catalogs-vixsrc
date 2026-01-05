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

async function getMeta(type, id) {
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

    // 1. Try Local DB
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
                            return fullMeta(row, type);
                        }
                    } catch (e) {
                        console.log('[MetaService] Failed to parse stored episodes:', e.message);
                    }
                }

                const seasons = row.seasons ? JSON.parse(row.seasons) : [];
                row.episodes = [];

                // Fetch all valid seasons (excluding season 0/Specials if prefered, but Stremio usually wants them)
                // We'll limit concurrency to avoid blasting TMDB/Cache
                // Fetch logic: for each season number in `seasons` array
                const seasonNumbers = seasons.map(s => s.season_number);

                // Fetch in promise all
                const seasonData = await Promise.all(seasonNumbers.map(n => fetchSeason(tmdbId, n)));

                // Flatten episodes
                for (const s of seasonData) {
                    if (s && s.episodes) {
                        row.episodes.push(...s.episodes);
                    }
                }

                // Sort by season then episode
                row.episodes.sort((a, b) => (a.season_number - b.season_number) || (a.episode_number - b.episode_number));

            } catch (e) {
                console.error(`[MetaService] Error fetching episodes for ${tmdbId}: ${e.message}`);
            }
        }

        return fullMeta(row, type);
    }

    // 2. Fallback to TMDB Fetch
    try {
        // ... (existing fallback code - we could also enhance this but local DB is primary)
        // Note: original code calls fetchTMDB which returns details.
        // We might want to also fetch seasons here if we really depend on fallback.
        // For now, let's assume local DB is the main path.
        const result = await fetchTMDB(tmdbId, type);
        if (result && result.details) {
            const d = result.details;
            // ... (mapping)
            const mappedRow = {
                tmdb_id: d.id,
                // ... (rest of mapping)
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
                const seasonData = await Promise.all(seasonNumbers.map(n => fetchSeason(tmdbId, n)));
                for (const s of seasonData) {
                    if (s && s.episodes) {
                        mappedRow.episodes.push(...s.episodes);
                    }
                }
                mappedRow.episodes.sort((a, b) => (a.season_number - b.season_number) || (a.episode_number - b.episode_number));
            }

            return fullMeta(mappedRow, type);
        }
    } catch (e) {
        console.error(`[MetaService] Failed to fetch TMDB for ${id}:`, e.message);
    }

    return null;
}

module.exports = { fullMeta, toMetaPreview, buildCollectionMeta, getMeta };
