require('dotenv').config();
const { getDatabase } = require('../lib/db/index');
const { analyzeGenreWithAI } = require('../services/ingestion/googleAiClient');
const { AI_PROVIDER } = require('../config/settings');

async function processAnimalHorror() {
    console.log(`[GenreAI] Starting Animal Horror Classification (Provider: ${AI_PROVIDER})`);

    // Safety check
    if (AI_PROVIDER !== 'ollama') {
        console.warn(`[WARN] Provider is ${AI_PROVIDER}, but this script is optimized for Ollama. Expect Google fallback behavior or skips.`);
    }

    const db = getDatabase();

    // Select movies that are Horror but NOT yet Animal Horror. 
    // Or just all movies if we want to be thorough, but let's start with Horror to save tokens.
    // User said "remove animal horror from genre field" before, now wants to build it back up properly.
    // So let's look at all movies that have 'Horror' in genres.

    const rows = db.prepare(`
        SELECT tmdb_id, title, description, keywords, genres 
        FROM movie_metadata 
        WHERE genres LIKE '%Horror%' 
        AND genres NOT LIKE '%Animal Horror%'
    `).all();

    console.log(`[GenreAI] Found ${rows.length} candidates (Horror movies without Animal Horror tag).`);

    let updatedCount = 0;
    let processedCount = 0;

    const updateStmt = db.prepare("UPDATE movie_metadata SET genres = ? WHERE tmdb_id = ?");

    for (const row of rows) {
        processedCount++;
        // console.log(`[GenreAI] Processing ${processedCount}/${rows.length}: ${row.title}`);

        try {
            const result = await analyzeGenreWithAI(row.title, row.description, row.keywords, console.log);

            if (result && result.isAnimalHorror) {
                console.log(`[MATCH] ${row.title} identified as Animal Horror! Rationale: ${result.rationale}`);

                // Add to genres
                let genres = JSON.parse(row.genres || '[]');
                if (!genres.some(g => g.name === 'Animal Horror')) {
                    genres.push({ id: 0, name: 'Animal Horror' });

                    updateStmt.run(JSON.stringify(genres), row.tmdb_id);
                    updatedCount++;
                }
            } else {
                // console.log(`[SKIP] ${row.title}: ${result ? result.rationale : 'No AI response'}`);
            }

        } catch (e) {
            console.error(`[ERROR] Processing ${row.tmdb_id}: ${e.message}`);
        }

        // Small delay if needed? Ollama is local, but let's be nice.
        // await new Promise(r => setTimeout(r, 100)); 
    }

    console.log(`[GenreAI] Complete. Updated ${updatedCount} movies.`);
}

processAnimalHorror().catch(err => {
    console.error(err);
    process.exit(1);
});
