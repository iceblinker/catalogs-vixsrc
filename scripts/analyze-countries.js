const { getDatabase } = require('../lib/db');
const { ASIAN_COUNTRIES, EUROPEAN_COUNTRIES } = require('../config/constants');
const db = getDatabase();

console.log('--- Database Analysis: Country Coverage ---');

// Check total counts
const totalMovies = db.prepare('SELECT COUNT(*) as c FROM movie_metadata').get().c;
const totalSeries = db.prepare('SELECT COUNT(*) as c FROM tv_metadata').get().c;

// Check counts with valid country data
const moviesWithCountries = db.prepare("SELECT COUNT(*) as c FROM movie_metadata WHERE countries IS NOT NULL AND countries != '[]' AND countries != ''").get().c;
const seriesWithCountries = db.prepare("SELECT COUNT(*) as c FROM tv_metadata WHERE countries IS NOT NULL AND countries != '[]' AND countries != ''").get().c;

console.log(`Movies: ${moviesWithCountries}/${totalMovies} (${((moviesWithCountries / totalMovies) * 100).toFixed(1)}%) have country data`);
console.log(`Series: ${seriesWithCountries}/${totalSeries} (${((seriesWithCountries / totalSeries) * 100).toFixed(1)}%) have country data`);

// Sample Check for Asian/European codes
// JSON strings in DB use double quotes, e.g. ["IT","FR"].
// SQLite string literals use single quotes.
// So we need: countries LIKE '%"IT"%'

const asianCondition = ASIAN_COUNTRIES.map(c => `countries LIKE '%"${c}"%'`).join(' OR ');
const europeanCondition = EUROPEAN_COUNTRIES.map(c => `countries LIKE '%"${c}"%'`).join(' OR ');

// Fallback to simpler query if array is too long for one statement (though 50 items should be fine)
// Use a try-catch for the query execution
try {
    const asianMovies = db.prepare(`SELECT COUNT(*) as c FROM movie_metadata WHERE ${asianCondition}`).get().c;
    console.log(`Asian Movies matched: ${asianMovies}`);
} catch (e) {
    console.error('Asian query failed:', e.message);
}

try {
    const europeanMovies = db.prepare(`SELECT COUNT(*) as c FROM movie_metadata WHERE ${europeanCondition}`).get().c;
    console.log(`European Movies matched: ${europeanMovies}`);
} catch (e) {
    console.error('European query failed:', e.message);
}

console.log('--- Performance Test (LIMIT 100) ---');
try {
    const start = process.hrtime();
    db.prepare(`SELECT * FROM movie_metadata WHERE ${asianCondition} LIMIT 100`).all();
    const end = process.hrtime(start);
    console.log(`Asian Query Time: ${(end[0] * 1000 + end[1] / 1e6).toFixed(2)}ms`);
} catch (e) {
    console.error('Perf test failed:', e.message);
}

console.log('--- Empty Country Samples ---');
const empty = db.prepare("SELECT title, countries FROM movie_metadata WHERE (countries IS NULL OR countries = '[]' OR countries = '') LIMIT 5").all();
console.log(empty);
