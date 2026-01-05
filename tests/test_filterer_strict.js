const filterer = require('../services/streams/filterer');

const mockStreams = [
    { name: "Inception 2010 ITA", title: "Inception 2010 ITA" }, // Valid Movie
    { name: "Inception S01E01 ITA", title: "Inception S01E01 ITA" }, // Invalid Movie (Series)
    { name: "Breaking Bad S01E01 ITA", title: "Breaking Bad S01E01 ITA" }, // Valid Series
    { name: "Breaking Bad Movie ITA", title: "Breaking Bad Movie ITA" }, // Invalid Series (Movie)
    { name: "Breaking Bad Stagione 1 ITA", title: "Breaking Bad Stagione 1 ITA" } // Valid Series (Season Pack)
];

console.log("--- Testing Movie Filter ---");
const movieMeta = { name: "Inception", year: 2010 };
const movieResults = filterer.filter(mockStreams, movieMeta, 'movie');
console.log("Results:", movieResults.map(s => s.name));

if (movieResults.find(s => s.name.includes("S01E01"))) {
    console.error("FAIL: Series content found in movie results!");
} else {
    console.log("PASS: Series content filtered out.");
}

console.log("\n--- Testing Series Filter ---");
const seriesMeta = { name: "Breaking Bad" };
const seriesResults = filterer.filter(mockStreams, seriesMeta, 'series');
console.log("Results:", seriesResults.map(s => s.name));

if (seriesResults.find(s => s.name.includes("Movie"))) {
    console.error("FAIL: Movie content found in series results!");
} else {
    console.log("PASS: Movie content filtered out.");
}

if (!seriesResults.find(s => s.name.includes("Stagione 1"))) {
    console.error("FAIL: Season pack filtered out!");
} else {
    console.log("PASS: Season pack preserved.");
}
