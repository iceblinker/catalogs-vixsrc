require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { processSingleItem } = require('../services/ingestion/processor');
const { getDatabase } = require('../lib/db');
const movieRepo = require('../lib/db/repositories/movieRepository');
const tvRepo = require('../lib/db/repositories/tvRepository');

const RETRY_FILE = path.join(__dirname, '../ai_retry_queue.json');

async function processRetryQueue() {
    if (!fs.existsSync(RETRY_FILE)) {
        console.log('[AI-Retry] No queue file found.');
        return;
    }

    let queue = [];
    try {
        queue = JSON.parse(fs.readFileSync(RETRY_FILE, 'utf8'));
    } catch (e) {
        console.error('[AI-Retry] Error reading queue:', e.message);
        return;
    }

    if (queue.length === 0) {
        console.log('[AI-Retry] Queue is empty.');
        // Optional: delete empty file
        return;
    }

    console.log(`[AI-Retry] Processing ${queue.length} items from queue...`);
    const db = getDatabase();

    // We will process all items. If some fail again with 429, the processor 
    // will re-add them to the queue (thanks to our change in processor.js).
    // So we clear the current queue first (or overwrite it at the end).
    // Strategy: Read all, clear file, process. If any fail again, they get added back.

    // Backup incase of crash? No, simple is better.
    // However, processor.js reads/writes the file. 
    // To avoid race conditions, we should probably rename the file or lock it.
    // Simplest: Rename to .processing, then delete if successful.

    // Actually, processor.js appends. If we are running this script, we assume
    // the main update loop is probably NOT running, or we accept potential race.
    // Best approach for this simple script: 
    // 1. Load queue in memory.
    // 2. Empty the file immediately (so new 429s can be added).
    // 3. Process items.

    fs.writeFileSync(RETRY_FILE, '[]');

    const st = { movie: 0, tv: 0, errors: [], log: [] };
    const log = console.log;

    for (const task of queue) {
        log(`[AI-Retry] Retrying ${task.type} ${task.id}...`);

        // Force processing
        const res = await processSingleItem(task.id, task.type, log, st, true);

        if (res && res.item) {
            if (res.type === 'movie') {
                movieRepo.save(res.item);
                st.movie++;
            } else if (res.type === 'tv') {
                tvRepo.save(res.item);
                st.tv++;
            }
        }
    }

    console.log(`[AI-Retry] Complete. Fixed: Movie=${st.movie}, TV=${st.tv}.`);
}

processRetryQueue().catch(err => console.error(err));
