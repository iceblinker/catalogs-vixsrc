require('dotenv').config();
const { getDatabase } = require('../lib/db/index');
const { ensureCollection, upsertItem } = require('../services/search/chromaClient');

async function processEmbeddings() {
    console.log('[Embedder] Starting processing...');

    // Ensure Chroma collection exists
    await ensureCollection();

    const db = getDatabase();

    // Select all movies, possibly filtering those already embedded if we tracked it
    // For now, we process all to ensure syncing
    const rows = db.prepare('SELECT tmdb_id, title, description, keywords, release_year, genres FROM movie_metadata').all();
    console.log(`[Embedder] Found ${rows.length} movies.`);

    let successCount = 0;

    for (const row of rows) {
        // Construct a rich text representation for embedding
        const text = `
Title: ${row.title}
Year: ${row.release_year}
Genres: ${row.genres}
Keywords: ${row.keywords}
Description: ${row.description}
        `.trim();

        // Metadata for filtering payload (if needed later) or just display
        const metadata = {
            title: row.title,
            year: row.release_year,
            id: String(row.tmdb_id)
        };

        const success = await upsertItem(row.tmdb_id, text, metadata);
        if (success) {
            successCount++;
            if (successCount % 10 === 0) console.log(`[Embedder] Embedded ${successCount}/${rows.length}`);
        } else {
            // console.error(`[Embedder] Failed to embed ${row.tmdb_id}`);
        }

        // Small delay to be polite to the embedding API
        // await new Promise(r => setTimeout(r, 50));
    }

    console.log(`[Embedder] Complete. Embedded ${successCount} items.`);
}

processEmbeddings().catch(console.error);
