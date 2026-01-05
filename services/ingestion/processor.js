const movieRepo = require('../../lib/db/repositories/movieRepository');
const tvRepo = require('../../lib/db/repositories/tvRepository');
const skippedRepo = require('../../lib/db/repositories/skippedRepository');
const { fetchTMDB, normalizeProviders } = require('./tmdbClient');
const { fetchFromOMDB, extractRatings, extractBetterDescription } = require('./omdbClient');
const { generateDescription, translateText, fixMetadataWithAI, analyzeGenreWithAI } = require('./googleAiClient');
const { CATALOG_NAME } = require('../../config/settings');

const CURRENT_CATALOG = CATALOG_NAME;
// const sleep = ms => new Promise(r => setTimeout(r, ms));

const { SPECIAL_GENRE_CONFIG } = require('../../config/constants');

const isAsian = (text) => /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(text);

const fs = require('fs');
const path = require('path');
const RETRY_FILE = path.join(__dirname, '../../ai_retry_queue.json');

function appendToRetryQueue(id, type) {
    let queue = [];
    try {
        if (fs.existsSync(RETRY_FILE)) {
            queue = JSON.parse(fs.readFileSync(RETRY_FILE, 'utf8'));
        }
    } catch (e) { }

    // Avoid duplicates
    if (!queue.some(i => i.id === id && i.type === type)) {
        queue.push({ id, type, added_at: new Date().toISOString() });
        fs.writeFileSync(RETRY_FILE, JSON.stringify(queue, null, 2));
    }
}

function mapCommon(details, crews, mediaType) {
    const year = details.release_date ? parseInt(details.release_date.split('-')[0])
        : details.first_air_date ? parseInt(details.first_air_date.split('-')[0]) : null;
    const decade = year ? `${Math.floor(year / 10) * 10}s` : null;
    const runtime = details.runtime || (Array.isArray(details.episode_run_time) ? details.episode_run_time[0] : details.episode_run_time) || null;

    let existingNames = [];
    try {
        const repo = mediaType === 'movie' ? movieRepo : tvRepo;
        const row = repo.getById(details.id);
        if (row) {
            if (row.catalog_names) existingNames = JSON.parse(row.catalog_names);
            // Preserve episodes (custom)
            if (row.episodes) details._existingEpisodes = row.episodes;

            // --- FIX: Preserve Custom AI Genres (ID: 0) ---
            if (row.genres) {
                try {
                    const existingGenres = JSON.parse(row.genres);
                    const customGenres = existingGenres.filter(g => g.id === 0);
                    if (customGenres.length > 0) {
                        // Merge into details.genres if not already present
                        if (!details.genres) details.genres = [];
                        customGenres.forEach(cg => {
                            if (!details.genres.some(dg => dg.name === cg.name)) {
                                details.genres.push(cg);
                            }
                        });
                    }
                } catch (e) { /* ignore json parse error */ }
            }
        }
    } catch { }
    if (!existingNames.includes(CURRENT_CATALOG)) existingNames.push(CURRENT_CATALOG);

    const { providers, watch_providers, provider_catalog_names } = normalizeProviders(details['watch/providers']?.results || details.watch_providers, details);

    // --- Special Genre Injection ---
    let genres = details.genres || [];
    const keywords = details.keywords?.keywords || details.keywords?.results || [];
    const keywordStrings = keywords.map(k => k.name.toLowerCase());

    for (const [specialGenre, config] of Object.entries(SPECIAL_GENRE_CONFIG)) {
        // Skip if rating not met (optional, but good practice to filter noise)
        if (config.minRating && (details.vote_average || 0) < config.minRating) continue;

        // Check validTypes (e.g. only 'movie')
        if (config.validTypes && !config.validTypes.includes(mediaType)) continue;

        // Check requiredGenres (e.g. must be 'Horror')
        if (config.requiredGenres) {
            const currentGenreNames = genres.map(g => g.name);
            const hasRequired = config.requiredGenres.some(req => currentGenreNames.includes(req));
            if (!hasRequired) continue;
        }

        // Check keywords
        const hasKeyword = config.keywords.some(k => keywordStrings.some(ks => ks.includes(k.toLowerCase())));

        if (hasKeyword) {
            // Check extra exclusions if defined (e.g. Virus excludes Comedy)
            if (config.extraExclusions) {
                const genreNames = genres.map(g => g.name.toLowerCase());
                const hasExcluded = config.extraExclusions.some(ex => genreNames.some(gn => gn.includes(ex.toLowerCase())));
                if (hasExcluded) continue;
            }

            // Check if already present
            if (!genres.some(g => g.name === specialGenre)) {
                // Add special genre with a dummy ID (0 or negative to avoid conflict)
                genres.push({ id: 0, name: specialGenre });
            }
        }
    }

    const base = {
        tmdb_id: details.id,
        imdb_id: details.imdb_id || null,
        title: details.title || details.name || '',
        name: details.name || details.title || '',
        release_year: year,
        first_air_year: details.first_air_date ? parseInt(details.first_air_date.split('-')[0]) : null,
        genres: JSON.stringify(genres),
        rating: details.vote_average || null,
        director: JSON.stringify((crews || []).filter(c => c.job === 'Director')),
        cast: JSON.stringify(details.credits?.cast || []),
        trailers: JSON.stringify(details.videos?.results?.map(v => v.key) || []),
        logo_path: details.images?.logos?.[0]?.file_path ? `https://image.tmdb.org/t/p/original${details.images.logos[0].file_path}` : null,
        background_path: details.backdrop_path,
        poster_path: details.poster_path,
        runtime,
        description: details.overview || details.original_title || '',
        keywords: JSON.stringify(keywords),
        writers: JSON.stringify((crews || []).filter(c => c.job === 'Writer' || c.job === 'Screenplay')),
        countries: JSON.stringify(details.production_countries || []),
        original_title: details.original_title || details.original_name || '',
        popularity: details.popularity || null,
        decade,
        genre_ids: JSON.stringify(genres.map(g => g.id)),
        status: details.status,
        release_date: details.release_date || null,
        seasons: JSON.stringify(details.seasons || []),
        last_episode_to_air: JSON.stringify(details.last_episode_to_air || {}),
        next_episode_to_air: JSON.stringify(details.next_episode_to_air || {}),
        watch_providers: JSON.stringify(watch_providers),
        vote_count: details.vote_count || null,
        catalog_names: JSON.stringify(existingNames),
        primary_catalog: existingNames.length === 1 ? existingNames[0] : CURRENT_CATALOG,
        providers: JSON.stringify(providers),
        provider_catalog_names: JSON.stringify(provider_catalog_names),
        actual_type: mediaType,
        episodes: details._existingEpisodes || null
    };

    if (mediaType === 'movie') {
        Object.assign(base, {
            collection_id: details.belongs_to_collection?.id || null,
            collection_name: details.belongs_to_collection?.name || null,
            belongs_to_collection: JSON.stringify(details.belongs_to_collection || {}),
            adult: details.adult ? 1 : 0,
            budget: details.budget || null,
            revenue: details.revenue || null,
            tagline: details.tagline || '',
            video: details.video ? 1 : 0,
            production_companies: JSON.stringify(details.production_companies || [])
        });
    } else {
        Object.assign(base, {
            created_by: JSON.stringify(details.created_by || []),
            episode_run_time: JSON.stringify(details.episode_run_time || []),
            in_production: details.in_production ? 1 : 0,
            languages: JSON.stringify(details.languages || []),
            last_air_date: details.last_air_date || null,
            networks: JSON.stringify(details.networks || []),
            number_of_episodes: details.number_of_episodes || null,
            number_of_seasons: details.number_of_seasons || null,
            origin_country: JSON.stringify(details.origin_country || []),
            production_companies: JSON.stringify(details.production_companies || []),
            type: details.type || null
        });
    }
    return base;
}

async function processSingleItem(id, initialType, log, st, force = false) {
    // Check if exists
    if (!force && (movieRepo.exists(id) || tvRepo.exists(id))) {
        st.already++;
        return null; // Signal skipping
    }

    const status = { tmdbId: id, result: '', details: '' };

    try {
        let result = await fetchTMDB(id, initialType, log);

        if (!result && initialType !== 'tv') {
            result = await fetchTMDB(id, 'tv', log);
        }
        if (!result && initialType !== 'movie') {
            result = await fetchTMDB(id, 'movie', log);
        }

        if (!result) {
            skippedRepo.save(id, '404 both types', new Date().toISOString(), CURRENT_CATALOG);
            st.skipped++;
            status.result = 'skipped_404';
            st.log.push(status);
            return null;
        }

        const { details, actualType } = result;
        let item;

        item = mapCommon(details, details.credits?.crew || [], actualType);

        // --- 1. Cheap Title Fix (Asian -> English via TMDB) ---
        if (isAsian(item.title)) {
            let engTitle = null;
            // Try TMDB translations
            const trans = details.translations?.translations?.find(t => t.iso_639_1 === 'en');
            if (trans?.data?.title) engTitle = trans.data.title;

            // Try alternatives
            if (!engTitle) {
                const alts = details.alternative_titles?.titles || details.alternative_titles?.results || [];
                const alt = alts.find(t => t.iso_3166_1 === 'US' || t.iso_3166_1 === 'GB');
                if (alt) engTitle = alt.title;
            }

            if (engTitle && !isAsian(engTitle)) {
                item.title = engTitle;
                log(`[TMDB] Found English title: ${item.title}`);
            }
        }

        // --- 2. Cheap Description Fix (TMDB Translations) ---
        let englishDescCandidate = item.description;
        if (!item.description || item.description.length < 20 || isAsian(item.description)) {
            const trans = details.translations?.translations?.find(t => t.iso_639_1 === 'it');
            if (trans?.data?.overview && trans.data.overview.length > 20) {
                item.description = trans.data.overview;
                log(`[TMDB] Found Italian description`);
            } else {
                const transEn = details.translations?.translations?.find(t => t.iso_639_1 === 'en');
                if (transEn?.data?.overview && transEn.data.overview.length > 20) {
                    englishDescCandidate = transEn.data.overview;
                }
            }
        }

        // --- 3. OMDB Enrichment ---
        if (details.imdb_id) {
            try {
                const omdbData = await fetchFromOMDB(details.imdb_id, log);
                if (omdbData) {
                    const betterDesc = extractBetterDescription(omdbData, item.description);
                    if (betterDesc) {
                        item.description = betterDesc;
                        log(`[OMDB] Upgraded description for ${item.title}`);
                    }
                }
            } catch (e) { log(`[OMDB] Failed enrichment: ${e.message}`); }
        }

        // --- 4. Google AI Optimization (Unified Fix) ---
        const needsTitleFix = isAsian(item.title);
        const needsDescFix = !item.description || item.description.length < 20 || isAsian(item.description);

        if (needsTitleFix || needsDescFix) {
            const aiRes = await fixMetadataWithAI(item.title, item.release_year || item.first_air_year, englishDescCandidate, log);

            if (aiRes.error === 429) {
                log(`[AI] Rate Limit 429 for ${id}. Adding to retry queue.`);
                appendToRetryQueue(id, actualType);
            }

            if (aiRes.title && needsTitleFix) {
                item.title = aiRes.title;
                log(`[AI] Fixed Title: ${aiRes.title}`);
            }
            if (aiRes.description && needsDescFix) {
                item.description = aiRes.description;
                log(`[AI] Generated Description`);
            }
        }

        // --- 5. AI Genre Analysis (Animal Horror) ---
        // Only run for Movies and only if not already tagged (or we want to verify)
        // User requested high accuracy. We check if genres include Horror/Thriller OR keywords match
        // and let AI decide final verdict.
        if (actualType === 'movie') {
            const currentGenres = item.genres ? JSON.parse(item.genres) : [];
            const hasAnimalConfig = SPECIAL_GENRE_CONFIG['Animal Horror'];

            // Broad Check: If it's Horror/Thriller/Action OR has keywords, check it.
            // But checking ALL movies is safest for "not capturing others".
            // To be efficient, let's check anything that isn't explicitly excluded (like Documentary/Romance unless mixed)
            // For now, let's rely on a slightly broader catch: Horror, Thriller, Action, Adventure, Sci-Fi.
            const candidateGenres = ['Horror', 'Thriller', 'Action', 'Adventure', 'Science Fiction', 'TV Movie'];
            const isCandidate = currentGenres.some(g => candidateGenres.includes(g.name));

            if (isCandidate) {
                const aiGenreRes = await analyzeGenreWithAI(item.title, item.description, item.keywords, log);
                if (aiGenreRes && aiGenreRes.isAnimalHorror) {
                    if (!currentGenres.some(g => g.name === 'Animal Horror')) {
                        currentGenres.push({ id: 0, name: 'Animal Horror' });
                        item.genres = JSON.stringify(currentGenres);
                        // Also Add ID to genre_ids
                        const gIds = JSON.parse(item.genre_ids || '[]');
                        gIds.push(0);
                        item.genre_ids = JSON.stringify(gIds);
                        log(`[AI] Tagged as Animal Horror: ${item.title} (${aiGenreRes.rationale})`);
                    }
                }
            }
        }

        // --- ENFORCE STREAMINGUNITY ---
        if (CURRENT_CATALOG && CURRENT_CATALOG.toLowerCase().includes('streamingunity')) {
            // Since status logic was tied to loop, we assume simple mapping for now. 
            // Ideally we pass special metadata if needed, but for now we follow item fields.
        }

        status.result = `added_${actualType}`;
        st.log.push(status);
        log(`[Process] PREP  ${actualType}  ${item.title || item.name}  (ID: ${id})`);

        return { type: actualType, item };

    } catch (error) {
        st.errors.push(`Exception ${id}: ${error.message}`);
        status.result = 'error';
        st.log.push(status);
        log(`[Process] EXCEPTION ${id}: ${error.message}`);
        return null;
    }
}

async function processList(ids, initialType, log = console.log) {
    const st = { movie: 0, tv: 0, skipped: 0, already: 0, errors: [], log: [] };
    const BATCH_SIZE = 5; // Use 5 for safety first

    log(`[Process] Starting ${ids.length} IDs, initial type: ${initialType} (Concurrent Batch: ${BATCH_SIZE})`);

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        log(`[Process] Batch ${i + 1}-${Math.min(i + BATCH_SIZE, ids.length)} / ${ids.length}`);

        const results = await Promise.all(chunk.map(id => processSingleItem(id, initialType, log, st)));

        const moviesToSave = [];
        const tvsToSave = [];

        results.forEach(res => {
            if (!res) return;
            if (res.type === 'movie') moviesToSave.push(res.item);
            else if (res.type === 'tv') tvsToSave.push(res.item);
        });

        if (moviesToSave.length) {
            movieRepo.saveMany(moviesToSave);
            st.movie += moviesToSave.length;
        }
        if (tvsToSave.length) {
            tvRepo.saveMany(tvsToSave);
            st.tv += tvsToSave.length;
        }
    }

    log(`[Process] Finished  added-movie:${st.movie}  added-tv:${st.tv}  skipped:${st.skipped}  already:${st.already}  errors:${st.errors.length}`);
    return st;
}

module.exports = { processList, mapCommon, processSingleItem };
