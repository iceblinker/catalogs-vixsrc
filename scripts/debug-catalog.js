
require('dotenv').config();
const { getCatalogItems } = require('../services/catalogService');
const { ITALIAN_TO_ENGLISH_GENRES } = require('../config/constants');
const { getDatabase } = require('../lib/db');

async function debug() {
    console.log('--- DEBUGGING CATALOG SERVICE ---');

    // 1. Check Mapping
    console.log(`Mapping for "Azione": "${ITALIAN_TO_ENGLISH_GENRES['Azione']}"`);
    console.log(`Mapping for "Avventura": "${ITALIAN_TO_ENGLISH_GENRES['Avventura']}"`);

    // 2. Direct DB Query
    const db = getDatabase();
    const actionCount = db.prepare("SELECT COUNT(*) as c FROM movie_metadata WHERE genres LIKE '%Action%'").get().c;
    const azioneCount = db.prepare("SELECT COUNT(*) as c FROM movie_metadata WHERE genres LIKE '%Azione%'").get().c;
    console.log(`DB "Action" count: ${actionCount}`);
    console.log(`DB "Azione" count: ${azioneCount}`);

    // 3. Service Call
    try {
        console.log('Calling getCatalogItems("movie", "vixsrc_movies", { genre: "Azione" })...');
        const result = await getCatalogItems('movie', 'vixsrc_movies', { genre: 'Azione' });
        console.log(`Result count: ${result.metas.length}`);
        if (result.metas.length > 0) {
            console.log('First item:', result.metas[0].name);
        }
    } catch (e) {
        console.error('Service call failed:', e);
    }
}

debug();
