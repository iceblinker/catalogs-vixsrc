require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
console.log('Requiring routes/streams...');
const streamsRouter = require('./routes/streams');
console.log('Requiring routes/play...');
const playRouter = require('./routes/play');

const app = express();
app.use(cors());
app.use(express.json());

// Load Manifest
const MANIFEST = {
    id: "com.vixsrc.stream-provider",
    version: "1.0.0",
    name: "VixSrc Streams",
    description: "Stream Resolver for VixSrc Catalogs",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tmdb"],
    catalogs: []
};

app.get('/manifest.json', (req, res) => {
    res.send(MANIFEST);
});

// Mount Routes
app.use('/stream', streamsRouter);
app.use('/play', playRouter);

const PORT = process.env.PORT || 3001; // Default to 3001 to avoid conflict with catalog addon
app.listen(PORT, () => {
    console.log(`Stream Provider Addon running on port ${PORT}`);
});
