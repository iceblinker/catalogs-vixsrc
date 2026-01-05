const { runAllScrapers } = require('../services/ingestion/streamingUnityScraper');
const { closeBrowser } = require('../services/ingestion/stealthBrowser');

async function populate() {
    console.log('[Populate] Starting full catalog scrape (6 catalogs)...');
    try {
        await runAllScrapers(console.log);
        console.log('[Populate] SUCCESS! All 6 catalog files updated.');
    } catch (e) {
        console.error('[Populate] FAILED:', e);
    } finally {
        await closeBrowser();
    }
}

populate();
