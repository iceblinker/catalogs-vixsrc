const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const { run: runAiUpdates } = require('./ai-catalog-updater');
const { run: runProviderRefresh } = require('./force_refresh_providers');

const ROOT_DIR = path.join(__dirname, '..');
const LOG_FILE = path.join(ROOT_DIR, 'nightly_update.log');

function log(msg) {
    const line = `[${new Date().toISOString()}] [NIGHTLY] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

/**
 * Run a Node.js script via child_process
 * @param {string} scriptPath 
 * @param {string} name 
 */
function runScript(scriptPath, name) {
    return new Promise((resolve, reject) => {
        log(`STARTING: ${name} (${scriptPath})`);

        const child = spawn('node', [scriptPath], {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
        });

        child.on('close', (code) => {
            if (code === 0) {
                log(`FINISHED: ${name}`);
                resolve();
            } else {
                const err = `FAILED: ${name} (Exit Code: ${code})`;
                log(err);
                reject(new Error(err));
            }
        });

        child.on('error', (err) => {
            log(`ERROR spawning ${name}: ${err.message}`);
            reject(err);
        });
    });
}

async function runNightlyUpdate() {
    log('=== NIGHTLY UPDATE SEQUENCE INITIATED ===');

    try {
        // 1. Scrape & Harmonize (Main Catalog)
        // This runs ingest, harmonize, and updates list caches.
        await runScript('update-vixsrc-catalog.js', 'VixSrc Scraper & Harmonizer');

        // 2. AI Catalog Classification (Tagging)
        // This adds "Animal Terror", "Virus", "Apocalypse" tags to new content.
        log('STARTING: AI Catalog Updater');
        await runAiUpdates();
        log('FINISHED: AI Catalog Updater');

        // 3. Provider Refresh (Optional - maybe run weekly?)
        // For now, we'll run it to ensure cached providers are fresh.
        // log('STARTING: Provider Refresh');
        // await runProviderRefresh();
        // log('FINISHED: Provider Refresh');

        log('=== NIGHTLY UPDATE SEQUENCE COMPLETED SUCCESSFULLY ===');

    } catch (error) {
        log(`CRITICAL FAILURE: ${error.message}`);
        process.exit(1);
    }
}

// Execute
if (require.main === module) {
    runNightlyUpdate();
}

module.exports = { runNightlyUpdate };
