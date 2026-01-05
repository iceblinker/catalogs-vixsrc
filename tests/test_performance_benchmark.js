const ilCorsaroNero = require('../services/streams/scrapers/ilcorsaronero');
const animeunity = require('../services/streams/scrapers/animeunity');
const torrentgalaxy = require('../services/streams/scrapers/torrentgalaxy');
const knaben = require('../services/streams/scrapers/knaben');
const debridio = require('../services/streams/scrapers/debridio');
const toonitalia = require('../services/streams/scrapers/toonitalia');
const zilean = require('../services/streams/scrapers/zilean');
const torbox = require('../services/streams/scrapers/torbox');
const guardaserie = require('../services/streams/scrapers/guardaserie');
const eurostreaming = require('../services/streams/scrapers/eurostreaming');
const animesaturn = require('../services/streams/scrapers/animesaturn');
const animeworld = require('../services/streams/scrapers/animeworld');
const vixcloud = require('../services/streams/scrapers/vixcloud');
const x1337 = require('../services/streams/scrapers/1337x');
const tpb = require('../services/streams/scrapers/tpb');

const testCases = [
    {
        id: "tmdb:1363123",
        type: "movie",
        name: "The Family Plan 2",
        year: "2025"
    },
    {
        id: "tmdb:1425122",
        type: "movie",
        name: "A Very Jonas Christmas Movie",
        year: "2025"
    },
    {
        id: "tmdb:1446358",
        type: "movie",
        name: "Uno sposo e due spose",
        year: "2025"
    },
    {
        id: "tmdb:1426792",
        type: "movie",
        name: "Mango",
        year: "2025"
    }
];

const scrapers = [
    { name: 'IlCorsaroNero', run: (q, t, m) => ilCorsaroNero.search(q, t) },
    { name: 'AnimeUnity', run: (q, t, m) => animeunity.searchAndResolve(q, t) },
    { name: 'ToonItalia', run: (q, t, m) => toonitalia.getStreams(q) },
    { name: 'TorrentGalaxy', run: (q, t, m) => torrentgalaxy.getStreams(q + ' ITA') },
    { name: 'Knaben', run: (q, t, m) => knaben.getStreams(q + ' ITA') },
    { name: '1337x', run: (q, t, m) => x1337.getStreams(q + ' ITA') },
    { name: 'TPB', run: (q, t, m) => tpb.getStreams(q + ' ITA') },
    { name: 'DebridIO', run: (q, t, m) => debridio.getStreams(t, m.id) }, // Passing ID directly
    { name: 'Zilean', run: (q, t, m) => zilean.getStreams(q) },
    { name: 'TorBox', run: (q, t, m) => torbox.getStreams(q) },
    { name: 'Guardaserie', run: (q, t, m) => guardaserie.search(q, t) },
    { name: 'Eurostreaming', run: (q, t, m) => eurostreaming.search(q, t) },
    { name: 'AnimeSaturn', run: (q, t, m) => animesaturn.search(q, t) },
    { name: 'AnimeWorld', run: (q, t, m) => animeworld.search(q, t) },
    { name: 'VixCloud', run: (q, t, m) => vixcloud.getStreams(t, m.id) }
];

async function runBenchmark() {
    console.log("Starting Scraper Benchmark...");
    console.log("--------------------------------------------------");

    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.name} (${testCase.year})`);
        console.log("--------------------------------------------------");

        const results = [];

        for (const scraper of scrapers) {
            const start = Date.now();
            let count = 0;
            let error = null;

            try {
                // Race with a hard timeout of 25s to emulate system behavior but capture the hang
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 25000));
                const scraperPromise = scraper.run(testCase.name, testCase.type, testCase);

                const streams = await Promise.race([scraperPromise, timeoutPromise]);
                count = streams ? streams.length : 0;
            } catch (e) {
                error = e.message;
            }

            const duration = Date.now() - start;
            results.push({ name: scraper.name, duration, count, error });

            // Log immediately for feedback
            let status = error ? `❌ ${error}` : `✅ ${count} streams`;
            console.log(`${scraper.name.padEnd(15)} | ${duration.toString().padEnd(5)}ms | ${status}`);
        }
    }
}

runBenchmark();
