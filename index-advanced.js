/*  index-advanced.js  – full Stremio addon + dashboard back-end
    Serves: main, provider, keyword, collection catalogs + dashboard REST + live log tail
*/
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const {
    KEYWORD_CATALOG,
    LOG_FILE
} = require('./config/settings');

const {
    KEYWORD_CATALOGS,
    MOVIE_GENRES,
    SERIES_GENRES,
    PROVIDER_MOVIE_GENRES,
    PROVIDER_SERIES_GENRES,
    MANIFEST_PROVIDERS_MOVIE,
    MANIFEST_PROVIDERS_SERIES,
    COLLEZIONI_POPOLARI_GENRES,
    SERIETV_COLLECTIONS_GENRES
} = require('./config/constants');

// --- Repositories & DB ---
const { getDatabase } = require('./lib/db');
getDatabase();

// --- Routes ---
const catalogRouter = require('./routes/catalog');
const metaRouter = require('./routes/meta');
const dashboardRouter = require('./routes/dashboard');

const app = express();

// --- Logging ---
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

// --- Manifest ---
const MANIFEST = {
    id: "com.vixsrc.stremio-addon",
    version: "1.0.1",
    name: "VixSrc Catalogs",
    description: "Cataloghi italiani arricchiti con metadati TMDB",
    resources: ["catalog", "meta"],
    types: ["movie", "series"],
    idPrefixes: ["tmdb", "ctmdb", "tt"],
    behaviorHints: {
        configurable: true,
        configurationRequired: false,
        p2p: true
    },
    catalogs: [
        {
            type: "movie",
            id: "vixsrc_movies",
            name: "Film VixSrc",
            extraSupported: ["search", "genre", "skip"],
            extraRequired: [],
            extra: [{ name: "search" }, { name: "genre", options: MOVIE_GENRES }, { name: "skip" }]
        },
        {
            type: "movie",
            id: "vixsrc_provider_movie",
            name: "Film per Provider",
            extraSupported: ["provider", "search", "genre", "skip"],
            extraRequired: ["provider"],
            extra: [{ name: "provider", options: MANIFEST_PROVIDERS_MOVIE, isRequired: true }, { name: "genre", options: PROVIDER_MOVIE_GENRES }, { name: "skip" }]
        },
        {
            type: "movie",
            id: "vixsrc_movie_collections",
            name: "Collezioni Popolari",
            extraSupported: ["genre"],
            extraRequired: [],
            extra: [{ name: "genre", options: COLLEZIONI_POPOLARI_GENRES }]
        },
        {
            type: "series",
            id: "vixsrc_series",
            name: "Serie VixSrc",
            extraSupported: ["search", "genre", "skip"],
            extraRequired: [],
            extra: [{ name: "search" }, { name: "genre", options: SERIES_GENRES }, { name: "skip" }]
        },
        {
            type: "series",
            id: "vixsrc_provider_series",
            name: "Serie per Provider",
            extraSupported: ["provider", "search", "genre", "skip"],
            extraRequired: ["provider"],
            extra: [{ name: "provider", options: MANIFEST_PROVIDERS_SERIES, isRequired: true }, { name: "genre", options: PROVIDER_SERIES_GENRES }, { name: "skip" }]
        },
        // Dynamically add all defined Keyword Catalogs - REMOVED per user request
        // ...Object.entries(KEYWORD_CATALOGS).flatMap(([key, k]) => [
        //     {
        //         type: "movie",
        //         id: `vixsrc_${key}_movies`,
        //         name: k.name,
        //         extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false }, { name: "skip", isRequired: false }]
        //     },
        //     {
        //         type: "series",
        //         id: `vixsrc_${key}_series`,
        //         name: k.name,
        //         extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false }, { name: "skip", isRequired: false }]
        //     }
        // ]),

        { type: "movie", id: "vixsrc_collection_items", name: "Collection Items", extra: [{ name: "collection_id", isRequired: true }, { name: "skip", isRequired: false }] },

    ]
};

// --- Middleware ---
app.use(cors()); // Allow all
app.use((req, res, next) => {
    // Manually enforce CORS headers to be sure
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});
app.use(express.json());
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        res.status(504).send({ error: 'Request timed out' });
    });
    next();
});

// --- Routes Mounting ---
app.get('/manifest.json', (req, res) => {
    log('[Manifest] /manifest.json requested');
    res.send(MANIFEST);
});

// Serve static dashboard files (SECURE: Only specific files)
app.get('/', (req, res) => {
    if (fs.existsSync(path.join(__dirname, 'dashboard.html'))) {
        res.sendFile(path.join(__dirname, 'dashboard.html'));
    } else {
        res.send('VixSrc Addon (v1.0.1) is running. Go to /dashboard.html for management.');
    }
});
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.use('/catalog', catalogRouter);
app.use('/meta', metaRouter);
app.use('/dashboard', dashboardRouter);


// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    log(`[Start] Addon server listening on :${PORT}`);

    // Sync collections images on startup
    const { syncCollectionsImages } = require('./services/ingestion/tmdbClient');
    syncCollectionsImages().catch(err => console.error('Error syncing collection images:', err));
});
