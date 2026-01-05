const express = require('express');
const router = express.Router();
const { getDatabase } = require('../lib/db/index');
const movieRepo = require('../lib/db/repositories/movieRepository');
const tvRepo = require('../lib/db/repositories/tvRepository');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { LOG_FILE, UPDATE_STATUS_PATH, UPDATE_HISTORY_PATH } = require('../config/settings');

// Helper for logging (local to this module or imported if I centralize logger later)
const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, line + '\n');
    } catch (e) {
        if (e.code === 'EBUSY') {
            // Silently ignore file lock errors
        } else {
            console.error('Log write error:', e);
        }
    }
};

router.get('/stats', (req, res) => {
    const { provider } = req.query;
    const w = provider ? `WHERE providers LIKE '%${provider}%'` : '';
    const m = movieRepo.count(w);
    const t = tvRepo.count(w);
    res.json({ movieCount: m, tvCount: t, total: m + t });
});

router.get('/genre-totals', (req, res) => {
    const { provider } = req.query;
    const w = provider ? `WHERE providers LIKE '%${provider}%'` : '';

    function cnt(repo) {
        const table = repo === movieRepo ? 'movie_metadata' : 'tv_metadata';
        const rows = getDatabase().prepare(`SELECT genres FROM ${table} ${w}`).all();
        const counts = {};
        rows.forEach(r => {
            let g = []; try { g = JSON.parse(r.genres || '[]').map(x => x.name || x); } catch { }
            g.forEach(n => counts[n] = (counts[n] || 0) + 1);
        });
        return counts;
    }
    res.json({ movies: cnt(movieRepo), series: cnt(tvRepo) });
});

router.get('/provider-analytics', (req, res) => {
    function cnt(repo) {
        const table = repo === movieRepo ? 'movie_metadata' : 'tv_metadata';
        const rows = getDatabase().prepare(`SELECT providers FROM ${table}`).all();
        const counts = {};
        rows.forEach(r => {
            let p = []; try { p = JSON.parse(r.providers || '[]'); } catch { }
            p.forEach(n => counts[n] = (counts[n] || 0) + 1);
        });
        return counts;
    }
    res.json({ movies: { providerCounts: cnt(movieRepo) }, series: { providerCounts: cnt(tvRepo) } });
});

router.get('/update-status', (req, res) => {
    if (!fs.existsSync(UPDATE_STATUS_PATH)) return res.status(404).send({ error: 'Status file not found' });
    try {
        const status = JSON.parse(fs.readFileSync(UPDATE_STATUS_PATH, 'utf8'));
        res.json(status);
    } catch (e) { res.status(500).send({ error: 'Failed to read update status' }); }
});

router.get('/update-history', (req, res) => {
    res.send(JSON.parse(fs.readFileSync(UPDATE_HISTORY_PATH, 'utf8') || '[]'));
});

router.post('/run-update', (req, res) => {
    log('[API] /api/run-update POST');
    const out = { success: false, output: '', code: 0 };
    // update-vixsrc-catalog.js is in the root directory
    const scriptPath = path.join(__dirname, '../update-vixsrc-catalog.js');
    const job = spawn('node', [scriptPath], { cwd: path.join(__dirname, '..'), env: process.env });
    job.stdout.on('data', d => out.output += d.toString());
    job.stderr.on('data', d => out.output += d.toString());
    job.on('close', code => { out.code = code; out.success = code === 0; log(`[API] Finished code:${code}`); res.json(out); });
});

router.post('/manual-update', (req, res) => {
    const { tmdb_id, type, field, value, mode } = req.body;
    log(`[API] /manual-update ${type} ${tmdb_id} ${field} ${mode}`);

    if (!tmdb_id || !type || !field) return res.status(400).json({ error: 'Missing required fields' });

    const repo = type === 'movie' ? movieRepo : tvRepo;
    const item = repo.getById(tmdb_id);

    if (!item) return res.status(404).json({ error: 'Item not found' });

    try {
        let newValue = value;

        // Handle "Add" mode
        if (mode === 'add') {
            // Check if field is JSON array
            try {
                const currentArr = JSON.parse(item[field] || '[]');
                if (Array.isArray(currentArr)) {
                    // It's an array (e.g. genres, catalog_names)
                    // If value is a string, try to parse it as JSON if it looks like one, otherwise treat as single item
                    let valToAdd = value;
                    try { valToAdd = JSON.parse(value); } catch { }

                    if (Array.isArray(valToAdd)) {
                        currentArr.push(...valToAdd);
                    } else {
                        currentArr.push(valToAdd);
                    }
                    // Deduplicate simple arrays
                    const unique = [...new Set(currentArr.map(x => typeof x === 'object' ? JSON.stringify(x) : x))]
                        .map(x => { try { return JSON.parse(x); } catch { return x; } });

                    newValue = JSON.stringify(unique);
                } else {
                    // Not an array, just append string
                    newValue = (item[field] || '') + ' ' + value;
                }
            } catch {
                // Not JSON, append string
                newValue = (item[field] || '') + ' ' + value;
            }
        } else {
            // Replace mode
            // If field expects JSON (like genres), try to ensure valid JSON if user provided string
            if (['genres', 'catalog_names', 'cast', 'director', 'writers'].includes(field)) {
                try { JSON.parse(value); } catch {
                    // If user didn't provide valid JSON for a JSON field, maybe wrap it? 
                    // For now, let's assume user knows what they are doing or provide simple string -> array logic
                    // But to be safe, if it fails parsing and it's a known array field, we might want to error or wrap.
                    // Let's just save as is, but log warning.
                    log(`[WARN] Saving potentially invalid JSON to ${field}`);
                }
            }
        }

        // Update the field
        // We use a direct UPDATE query to avoid overwriting other fields if 'save' does full replace
        // But repo.save usually does INSERT OR REPLACE. 
        // Let's use a specific UPDATE query for safety and precision.
        const table = type === 'movie' ? 'movie_metadata' : 'tv_metadata';
        getDatabase().prepare(`UPDATE ${table} SET ${field} = ? WHERE tmdb_id = ?`)
            .run(newValue, tmdb_id);

        log(`[API] Updated ${type} ${tmdb_id} [${field}]`);
        res.json({ success: true, newValue });

    } catch (e) {
        log(`[API] Update failed: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

router.get('/item-details', (req, res) => {
    const { tmdb_id, type } = req.query;
    if (!tmdb_id || !type) return res.status(400).json({ error: 'Missing tmdb_id or type' });

    const repo = type === 'movie' ? movieRepo : tvRepo;
    const item = repo.getById(tmdb_id);

    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
});

router.get('/logs', (req, res) => {
    if (!fs.existsSync(LOG_FILE)) return res.send([]);
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    res.send(lines.slice(-200));
});

module.exports = router;
