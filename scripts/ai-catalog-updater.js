require('dotenv').config();
const { getDatabase } = require('../lib/db');
const { analyzeAnimalTerrorBatch, analyzeVirusBatch, analyzeSupernaturalBatch, analyzeApocalypseBatch } = require('../services/ingestion/googleAiClient');
const path = require('path');
const fs = require('fs');

const LOG_FILE = path.join(__dirname, '../ai-catalog-update.log');
const db = getDatabase();

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

/**
 * Generic processor for AI catalogs
 * @param {Object} config
 * @param {string} config.name Display name
 * @param {string} config.tagName Tag to add to genres
 * @param {string} config.table Database table name
 * @param {string} config.type 'movie' or 'series'
 * @param {Function} config.aiFunction AI analysis function
 * @param {string} config.query SQL Query (must return id, title, overview, keywords)
 */
async function processCatalog(config) {
    log(`STARTING ${config.name} (${config.type}) Update...`);

    // 1. SQL Pre-Filter
    const BATCH_SIZE = 20;
    const MAX_MOVIES_TO_PROCESS = 100; // Limit per category/type

    try {
        const candidates = db.prepare(config.query).all(MAX_MOVIES_TO_PROCESS);
        log(`[${config.name}-${config.type}] Found ${candidates.length} candidates.`);

        if (candidates.length === 0) {
            log(`[${config.name}-${config.type}] No candidates found.`);
            return;
        }

        // 2. Batch Process
        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            const batch = candidates.slice(i, i + BATCH_SIZE);
            log(`[${config.name}-${config.type}] Batch ${i + 1}-${i + batch.length}`);

            const payload = batch.map(m => ({
                id: m.id,
                title: m.title,
                overview: m.overview ? m.overview.substring(0, 300) : '',
                keywords: m.keywords ? m.keywords.substring(0, 200) : ''
            }));

            const confirmedIds = await config.aiFunction(payload, log);

            if (confirmedIds && confirmedIds.length > 0) {
                log(`[${config.name}-${config.type}] AI confirmed: ${confirmedIds.join(', ')}`);

                // 3. Update DB (Dynamic Table)
                const updateStmt = db.prepare(`
                    UPDATE ${config.table}
                    SET genres = json_insert(
                        CASE WHEN json_valid(genres) THEN genres ELSE '[]' END, 
                        '$[' || json_array_length(CASE WHEN json_valid(genres) THEN genres ELSE '[]' END) || ']', 
                        json_object('id', 0, 'name', '${config.tagName}')
                    )
                    WHERE tmdb_id = ?
                `);

                confirmedIds.forEach(id => {
                    try {
                        updateStmt.run(id);
                        log(`[${config.name}-${config.type}] UPDATED ${id}`);
                    } catch (e) {
                        log(`[${config.name}-${config.type}] ERROR updating ${id}: ${e.message}`);
                    }
                });
            }
        }
    } catch (err) {
        log(`[${config.name}-${config.type}] ERROR: ${err.message}`);
    }
}

async function run() {
    log('=== STARTING AI CATALOG UPDATE EXECUTION ===');

    const catalogs = [
        {
            name: 'Animal Terror',
            tagName: 'Animal Terror',
            aiFunc: analyzeAnimalTerrorBatch,
            keywords: `
            description LIKE '%attack%' OR description LIKE '%terror%' OR 
            description LIKE '%killer%' OR description LIKE '%creature%' OR
            description LIKE '%prey%' OR description LIKE '%animal%' OR
            description LIKE '%survive%' OR description LIKE '%hunt%' OR
            keywords LIKE '%shark%' OR keywords LIKE '%wolf%' OR 
            keywords LIKE '%snake%' OR keywords LIKE '%spider%' OR
            keywords LIKE '%bear%' OR keywords LIKE '%monster%' OR
            keywords LIKE '%animal%' OR keywords LIKE '%creature%'
            `
        },
        {
            name: 'Virus',
            tagName: 'Virus',
            aiFunc: analyzeVirusBatch,
            keywords: `
            description LIKE '%pandemic%' OR description LIKE '%epidemic%' OR 
            description LIKE '%outbreak%' OR description LIKE '%contagion%' OR
            description LIKE '%quarantine%' OR description LIKE '%infection%' OR
            description LIKE '%virus%' OR description LIKE '%biological%' OR
            description LIKE '%bacteria%' OR description LIKE '%amoeba%' OR
            description LIKE '%pathogen%' OR description LIKE '%plague%' OR
            keywords LIKE '%pandemic%' OR keywords LIKE '%virus%' OR 
            keywords LIKE '%bioweapon%' OR keywords LIKE '%post-apocalyptic%' OR
            keywords LIKE '%zombie%'
            `
        },
        {
            name: 'Supernatural',
            tagName: 'Supernatural',
            aiFunc: analyzeSupernaturalBatch,
            keywords: `
            description LIKE '%demon%' OR description LIKE '%spirit%' OR 
            description LIKE '%ghost%' OR description LIKE '%witch%' OR
            description LIKE '%haunt%' OR description LIKE '%possession%' OR
            description LIKE '%ouija%' OR description LIKE '%poltergeist%' OR
            description LIKE '%exorcism%' OR description LIKE '%curse%' OR
            description LIKE '%ritual%' OR description LIKE '%occult%' OR
            description LIKE '%magic%' OR description LIKE '%satanic%' OR
            keywords LIKE '%paranormal%' OR keywords LIKE '%ghost%' OR 
            keywords LIKE '%afterlife%' OR keywords LIKE '%spirit%' OR
            keywords LIKE '%witchcraft%' OR keywords LIKE '%supernatural%'
            `
        },
        {
            name: 'Apocalypse',
            tagName: 'Apocalypse',
            aiFunc: analyzeApocalypseBatch,
            keywords: `
            keywords LIKE '%apocalypse%' OR keywords LIKE '%post-apocalyptic%' OR
            keywords LIKE '%dystopia%' OR keywords LIKE '%aftermath%' OR
            keywords LIKE '%survival%' OR keywords LIKE '%societal collapse%' OR
            keywords LIKE '%shelter%' OR keywords LIKE '%bunker%' OR
            description LIKE '%apocalypse%' OR description LIKE '%post-apocalyptic%' OR 
            description LIKE '%end of the world%' OR description LIKE '%end of humanity%' OR
            description LIKE '%extinction%' OR description LIKE '%wasteland%' OR
            description LIKE '%collapse%' OR description LIKE '%survivor%' OR
            description LIKE '%nuclear%' OR description LIKE '%asteroid%' OR
            description LIKE '%comet%' OR description LIKE '%fallout%' OR
            description LIKE '%last man%' OR description LIKE '%last woman%'
            `
        }
    ];

    for (const cat of catalogs) {
        // --- MOVIES ---
        await processCatalog({
            name: cat.name,
            tagName: cat.tagName,
            table: 'movie_metadata',
            type: 'movie',
            aiFunction: cat.aiFunc,
            query: `
                SELECT tmdb_id as id, title, description as overview, genres, keywords
                FROM movie_metadata
                WHERE genres NOT LIKE '%"name":"${cat.tagName}"%'
                  AND genres NOT LIKE '%"name":"Romance"%'
                  AND genres NOT LIKE '%"name":"Documentary"%'
                  AND genres NOT LIKE '%"name":"Family"%'
                  AND genres NOT LIKE '%"name":"Music"%'
                  AND (${cat.keywords})
                LIMIT ?
            `
        });

        // --- SERIES ---
        // Note: For TV, fields might be 'name' instead of 'title', but we alias it in query.
        // Also excluding 'Reality' or 'Talk' might be wise if genre IDs are known, but name exclusions work too.
        await processCatalog({
            name: cat.name,
            tagName: cat.tagName,
            table: 'tv_metadata',
            type: 'series',
            aiFunction: cat.aiFunc,
            query: `
                SELECT tmdb_id as id, name as title, description as overview, genres, keywords
                FROM tv_metadata
                WHERE genres NOT LIKE '%"name":"${cat.tagName}"%'
                  AND genres NOT LIKE '%"name":"Romance"%'
                  AND genres NOT LIKE '%"name":"Documentary"%'
                  AND genres NOT LIKE '%"name":"Family"%'
                  AND genres NOT LIKE '%"name":"Music"%'
                  AND genres NOT LIKE '%"name":"Reality"%' 
                  AND genres NOT LIKE '%"name":"Talk"%'
                  AND (${cat.keywords})
                LIMIT ?
            `
        });
    }

    log('=== EXECUTION COMPLETE ===');
}

// Allow standalone execution
if (require.main === module) {
    run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
    module.exports = { run };
}
