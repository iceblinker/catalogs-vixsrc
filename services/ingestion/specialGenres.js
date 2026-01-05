const { TMDB_API_KEY, STREAMINGUNITY_XSRF_TOKEN, STREAMINGUNITY_SESSION } = require('../../config/settings');
const { getDatabase } = require('../../lib/db');
const movieRepo = require('../../lib/db/repositories/movieRepository');
const tvRepo = require('../../lib/db/repositories/tvRepository');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const fs = require('fs');
const path = require('path');

// --- Configuration for StreamingUnity ---
const XSRF_TOKEN = STREAMINGUNITY_XSRF_TOKEN;
const SESSION = STREAMINGUNITY_SESSION;
const PAGE_SIZE = 60;
const DELAY_MS = 2000;

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- TMDB Helpers ---
const TMDB_GENRES = {
    movie: {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
        18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
        9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller',
        10752: 'War', 37: 'Western',
    },
    tv: {
        10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
        18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery', 10763: 'News', 10764: 'Reality',
        10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
    }
};

function genreIdsToNames(arr, type) {
    if (!Array.isArray(arr)) return [];
    const map = TMDB_GENRES[type === 'movie' ? 'movie' : 'tv'];
    return arr.map(id => map[id] || (typeof id === 'string' ? id : undefined)).filter(Boolean);
}

async function fetchTmdbMeta(title, type, year) {
    const searchType = type === 'movie' ? 'movie' : 'tv';
    let url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}&language=it-IT`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.results || !data.results.length) return null;
        const result = data.results[0];

        // Basic mapping sufficient for enrichment
        let genreNames = [];
        if (Array.isArray(result.genre_ids) && result.genre_ids.length) {
            const map = TMDB_GENRES[type === 'movie' ? 'movie' : 'tv'];
            genreNames = result.genre_ids.map(id => map[id] || (typeof id === 'string' ? id : undefined)).filter(Boolean);
        }

        return {
            tmdb_id: result.id,
            title: result.title || result.name || title,
            name: result.name || result.title || title,
            release_year: (result.release_date || result.first_air_date || '').slice(0, 4),
            first_air_year: (result.first_air_date || '').slice(0, 4),
            genres: genreNames.length ? JSON.stringify(genreNames) : null,
            rating: result.vote_average,
            description: result.overview || '',
            poster_path: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
            background_path: result.backdrop_path ? `https://image.tmdb.org/t/p/original${result.backdrop_path}` : null,
            release_date: result.release_date || result.first_air_date || null,
            type: searchType
        };
    } catch (e) {
        return null;
    }
}

// --- StreamingUnity Fetching ---
async function fetchPage(type, genre, offset) {
    let url;
    if (genre === 'latest') {
        url = `https://streamingunity.so/api/browse/latest?type=${type}&lang=it&offset=${offset}&type=${type}`;
    } else if (genre === 'trending') {
        url = `https://streamingunity.so/api/browse/trending?type=${type}&lang=it&offset=${offset}&type=${type}`;
    } else if (genre === 'korean') {
        // Genre 26 = Korean Drama
        url = `https://streamingunity.so/api/archive?lang=it&offset=${offset}&type=${type}&genre[]=26`;
    } else {
        throw new Error('Unknown genre');
    }
    let referer;
    if (genre === 'korean') {
        referer = `https://streamingunity.so/it/archive?genre[]=26&type=${type}`;
    } else {
        referer = `https://streamingunity.so/it/browse/${genre}?type=${type}`;
    }
    try {
        const res = await fetch(url, {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'x-xsrf-token': XSRF_TOKEN,
                'cookie': `XSRF-TOKEN=${XSRF_TOKEN}; streamingcommunity_session=${SESSION}`,
                'referer': referer
            }
        });
        if (res.status === 503) return null;
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        return null;
    }
}

async function fetchAllPages(type, genre, log = console.log) {
    let allTitles = [];
    for (let page = 0; ; page++) {
        const offset = page * PAGE_SIZE;
        log(`[${genre.toUpperCase()}][${type}] Fetching offset ${offset}...`);
        const data = await fetchPage(type, genre, offset);
        if (!data || !data.titles || data.titles.length === 0) break;
        allTitles = allTitles.concat(data.titles);
        if (data.titles.length < PAGE_SIZE) break;
        await delay(DELAY_MS);
    }
    return allTitles;
}

// --- Enrichment Logic ---
function convertImageFilenames(images) {
    if (!Array.isArray(images)) return [];
    return images.map(img => ({
        ...img,
        url: img.filename ? `https://cdn.streamingunity.so/images/${img.filename}` : undefined
    }));
}

async function enrichTitles(titles, type, log = console.log) {
    const enriched = [];
    let dbAddCount = 0;
    const db = getDatabase();

    // Use repositories for lookups
    const repo = type === 'movie' ? movieRepo : tvRepo;

    for (let i = 0; i < titles.length; i++) {
        const t = titles[i];
        const images = convertImageFilenames(t.images);

        // Try DB lookup
        let dbMeta = null;
        const table = type === 'movie' ? 'movie_metadata' : 'tv_metadata';
        try {
            // We don't have getByTitle in repo, so use direct query for now or add to repo
            // For speed, let's use direct query here as it's specific to this logic
            dbMeta = db.prepare(`SELECT * FROM ${table} WHERE title = ? COLLATE NOCASE LIMIT 1`).get(t.name);
        } catch { }

        let meta = null;
        if (dbMeta && (dbMeta.tmdb_id || dbMeta.imdb_id)) {
            meta = { ...dbMeta };

            // FIX: Smart Upsert (Tagging + Metadata Injection)
            let currentCatalogs = [];
            try { currentCatalogs = JSON.parse(dbMeta.catalog_names || '[]'); } catch { }
            let needsUpdate = false;
            let updateFields = {};
            const suPlot = t.plot || t.description || '';

            // 1. Tag as streamingunity
            if (!currentCatalogs.includes('streamingunity')) {
                currentCatalogs.push('streamingunity');
                updateFields.catalog_names = JSON.stringify(currentCatalogs);
                needsUpdate = true;
            }

            // 2. Fix Asian Titles (If DB has CJK but SU is Latin)
            const cjkRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;
            if (cjkRegex.test(dbMeta.title) && !cjkRegex.test(t.name) && t.name) {
                updateFields.title = t.name;
                needsUpdate = true;
                // log(`[${type}] Fixed Asian title: ${dbMeta.title} -> ${t.name}`);
            }

            // 3. Improve Description (If DB is empty/short and SU is good)
            if ((!dbMeta.description || dbMeta.description.length < 20) && suPlot.length > 20) {
                updateFields.description = suPlot;
                needsUpdate = true;
                // log(`[${type}] Upgraded description for ${dbMeta.title}`);
            }

            if (needsUpdate) {
                try {
                    const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
                    const values = Object.values(updateFields);
                    // Add updated_at
                    const now = new Date().toISOString();

                    // Construct query carefully
                    db.prepare(`UPDATE ${table} SET ${setClause}, updated_at = ? WHERE tmdb_id = ?`)
                        .run(...values, now, dbMeta.tmdb_id);
                } catch (e) {
                    // log(`[${type}] Failed to update ${meta.title}: ${e.message}`);
                }
            }
        } else {
            meta = await fetchTmdbMeta(t.name, type, t.release_year || t.first_air_year || undefined);

            if (meta && meta.tmdb_id) {
                // Insert into DB so harmonizer can pick it up and enrich it fully
                const newItem = {
                    ...meta,
                    catalog_names: JSON.stringify(['streamingunity']),
                    primary_catalog: 'streamingunity',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                try {
                    const repo = type === 'movie' ? movieRepo : tvRepo;
                    // Check existence again just in case
                    if (!repo.getById(meta.tmdb_id)) {
                        repo.save(newItem);
                        dbAddCount++;
                        // log(`[${type}] Added streamingunity title: ${meta.title}`);
                    }
                } catch (e) {
                    // Ignore duplicates or constraints
                }
            }
        }

        enriched.push({ ...t, images, meta });
        await delay(100); // Small delay to be nice to TMDB if not cached
    }
    return enriched;
}

// --- Stremio Flattening Logic (Simplified) ---
function flattenEntry(entry, type) {
    const meta = entry.meta || {};
    const img = (entry.images || []).find(i => i.type === 'poster' && i.url);
    const bg = (entry.images || []).find(i => i.type === 'background' && i.url);

    return {
        id: meta.tmdb_id ? `tmdb:${meta.tmdb_id}` : (meta.imdb_id || entry.id),
        type: type,
        name: entry.name || meta.title || meta.name,
        poster: meta.poster_path || (img ? img.url : undefined),
        background: meta.background_path || (bg ? bg.url : undefined),
        description: meta.description || '',
        releaseInfo: meta.release_year || meta.first_air_year || '',
        imdbRating: meta.rating || '',
        genres: meta.genres ? JSON.parse(meta.genres) : []
    };
}

async function updateSpecialGenres(log = console.log) {
    // Novità Movies
    const novitaMovies = await fetchAllPages('movie', 'latest', log);
    const novitaMoviesEnriched = await enrichTitles(novitaMovies, 'movie', log);
    fs.writeFileSync('novita-movies.json', JSON.stringify(novitaMoviesEnriched, null, 2));
    const novitaMoviesStremio = novitaMoviesEnriched.map(e => flattenEntry(e, 'movie'));
    fs.writeFileSync('novita-movies-stremio.json', JSON.stringify(novitaMoviesStremio, null, 2));
    log(`Saved ${novitaMoviesEnriched.length} Novità movies`);

    // Trending Movies
    const trendingMovies = await fetchAllPages('movie', 'trending', log);
    const trendingMoviesEnriched = await enrichTitles(trendingMovies, 'movie', log);
    fs.writeFileSync('trending-movies.json', JSON.stringify(trendingMoviesEnriched, null, 2));
    const trendingMoviesStremio = trendingMoviesEnriched.map(e => flattenEntry(e, 'movie'));
    fs.writeFileSync('trending-movies-stremio.json', JSON.stringify(trendingMoviesStremio, null, 2));
    log(`Saved ${trendingMoviesEnriched.length} Trending movies`);

    // Trending Series
    const trendingSeries = await fetchAllPages('tv', 'trending', log);
    const trendingSeriesEnriched = await enrichTitles(trendingSeries, 'tv', log);
    fs.writeFileSync('trending-series.json', JSON.stringify(trendingSeriesEnriched, null, 2));
    const trendingSeriesStremio = trendingSeriesEnriched.map(e => flattenEntry(e, 'tv'));
    fs.writeFileSync('trending-series-stremio.json', JSON.stringify(trendingSeriesStremio, null, 2));
    log(`Saved ${trendingSeriesEnriched.length} Trending series`);

    // Novità Series (Latest TV)
    const novitaSeries = await fetchAllPages('tv', 'latest', log);
    const novitaSeriesEnriched = await enrichTitles(novitaSeries, 'tv', log);
    fs.writeFileSync('novita-series.json', JSON.stringify(novitaSeriesEnriched, null, 2));
    const novitaSeriesStremio = novitaSeriesEnriched.map(e => flattenEntry(e, 'tv'));
    fs.writeFileSync('novita-series-stremio.json', JSON.stringify(novitaSeriesStremio, null, 2));
    log(`Saved ${novitaSeriesEnriched.length} Novità series`);

    // Korean Drama removed (using Asian Drama country filter instead)
}

module.exports = { updateSpecialGenres };
