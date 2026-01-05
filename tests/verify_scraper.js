const { scrapeCatalog, runAllScrapers } = require('../services/ingestion/streamingUnityScraper');
const { closeBrowser } = require('../services/ingestion/stealthBrowser');

async function verify() {
    console.log('[Verify] Starting scrape test for Trending Series...');
    try {
        // Scrape just ONE catalog to verify logic
        await scrapeCatalog('trending-series');
        console.log('[Verify] SUCCESS! Check trending-series-stremio.json');
    } catch (e) {
        console.error('[Verify] FAILED:', e);
    } finally {
        await closeBrowser();
    }
}

verify();
