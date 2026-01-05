const filterer = require('../services/streams/filterer');

const mockStreams = [
    { name: "Movie 100MB", title: "Movie 100MB", size: "100 MB" }, // Too small for movie
    { name: "Movie 300MB", title: "Movie 300MB", size: "300 MB" }, // OK for movie
    { name: "Series S01E01 10MB", title: "Series S01E01 10MB", size: "10 MB" }, // Too small for series
    { name: "Series S01E01 60MB", title: "Series S01E01 60MB", size: "60 MB" }, // OK for series
    { name: "Unknown Size", title: "Unknown Size" } // Should pass (size 0)
];

console.log("--- Testing Movie Size Filter ---");
const movieMeta = { name: "Movie" };
const movieResults = filterer.filter(mockStreams, movieMeta, 'movie');
console.log("Results:", movieResults.map(s => s.name));

if (movieResults.find(s => s.name.includes("100MB"))) {
    console.error("FAIL: Small movie not filtered!");
} else {
    console.log("PASS: Small movie filtered.");
}

console.log("\n--- Testing Series Size Filter ---");
const seriesMeta = { name: "Series" };
const seriesResults = filterer.filter(mockStreams, seriesMeta, 'series');
console.log("Results:", seriesResults.map(s => s.name));

if (seriesResults.find(s => s.name.includes("10MB"))) {
    console.error("FAIL: Small series not filtered!");
} else {
    console.log("PASS: Small series filtered.");
}
