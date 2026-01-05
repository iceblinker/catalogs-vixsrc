require('dotenv').config();
const { getDatabase } = require('../lib/db/index');
const { analyzeContent } = require('../services/ingestion/googleAiClient');
const { AI_PROVIDER } = require('../config/settings');

// Configuration for this run
const TAG_PROFILE = {
    name: 'Mood & Tone',
    instruction: `
    Analyze the mood and tone of this movie.
    Return strictly VALID JSON with a list of tags. 
    Allowed Tags: "Dark", "Upbeat", "Suspenseful", "Romantic", "Cerebral", "Gritty", "Whimsical", "Disturbing", "Feel-Good".
    Max 3 tags.
    Format: { "tags": ["Tag1", "Tag2"] }
    `,
    targetColumn: 'ai_tags_mood' // In a real app, maybe a separate table or a generic 'tags' JSON column
};

async function processAiTagging() {
    console.log(`[AI-Tagger] Starting Tagging Job: ${TAG_PROFILE.name} (Provider: ${AI_PROVIDER})`);

    if (AI_PROVIDER !== 'ollama') {
        console.warn(`[WARN] Optimized for Ollama. Google provider may hit rate limits or costs.`);
    }

    const db = getDatabase();

    // Ensure column exists (simple migration for this script)
    try {
        db.prepare(`ALTER TABLE movie_metadata ADD COLUMN ${TAG_PROFILE.targetColumn} TEXT`).run();
        console.log(`[AI-Tagger] Added column ${TAG_PROFILE.targetColumn}`);
    } catch (e) { /* ignore if exists */ }

    // Select movies matching some criteria (e.g. popular ones first, or ones without tags)
    // For demo, let's take 10 random ones that don't have tags yet
    const rows = db.prepare(`
        SELECT tmdb_id, title, description, keywords 
        FROM movie_metadata 
        WHERE ${TAG_PROFILE.targetColumn} IS NULL
        ORDER BY popularity DESC
        LIMIT 20
    `).all();

    console.log(`[AI-Tagger] Found ${rows.length} candidates to tag.`);

    const updateStmt = db.prepare(`UPDATE movie_metadata SET ${TAG_PROFILE.targetColumn} = ? WHERE tmdb_id = ?`);

    for (const row of rows) {
        console.log(`[AI-Tagger] Analyzing: ${row.title}`);

        try {
            const result = await analyzeContent(
                row.title,
                row.description,
                row.keywords,
                TAG_PROFILE.instruction,
                true,
                console.log
            );

            if (result && Array.isArray(result.tags)) {
                console.log(`   -> Tags: ${result.tags.join(', ')}`);
                updateStmt.run(JSON.stringify(result.tags), row.tmdb_id);
            } else {
                console.log(`   -> No valid tags returned.`);
                // Mark as processed to avoid retry loop (optional, maybe distinct 'processed' flag)
                // For now, we leave NULL so we can retry later or debug
            }

        } catch (e) {
            console.error(`[ERROR] ${row.tmdb_id}: ${e.message}`);
        }

        // Politeness delay
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[AI-Tagger] Job Complete.`);
}

processAiTagging().catch(console.error);
