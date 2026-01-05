const filterer = require('../services/streams/filterer');

const mockStreams = [
    { name: "Movie 480p", title: "Movie 480p", size: "1 GB" }, // Reject
    { name: "Movie 720p", title: "Movie 720p", size: "2 GB" }, // Reject
    { name: "Movie 1080p", title: "Movie 1080p", size: "4 GB" }, // Keep
    { name: "Movie 4K", title: "Movie 4K", size: "10 GB" }, // Keep
    { name: "Movie 2160p", title: "Movie 2160p", size: "10 GB" }, // Keep
    { name: "Movie SD", title: "Movie SD", size: "1 GB" }, // Reject
    { name: "Movie HD", title: "Movie HD", size: "2 GB" }, // Reject (Ambiguous HD usually means 720p or bad rip)
    { name: "Movie HD 1080p", title: "Movie HD 1080p", size: "4 GB" }, // Keep (Explicit 1080p overrides HD)
    { name: "Movie DVDRip", title: "Movie DVDRip", size: "700 MB" }, // Reject
    { name: "Movie Unknown Res", title: "Movie Unknown Res", size: "2 GB" } // Keep (No explicit low res tag)
];

console.log("--- Testing Resolution Filter ---");
const meta = { name: "Movie" };
const results = filterer.filter(mockStreams, meta, 'movie');
console.log("Results:", results.map(s => s.name));

const rejected = ["480p", "720p", "SD", "HD", "DVDRip"];
const kept = ["1080p", "4K", "2160p", "HD 1080p", "Unknown Res"];

let pass = true;

rejected.forEach(tag => {
    if (results.find(s => s.name === `Movie ${tag}`)) {
        console.error(`FAIL: ${tag} was NOT filtered!`);
        pass = false;
    }
});

if (pass) {
    console.log("ALL TESTS PASSED");
} else {
    console.log("SOME TESTS FAILED");
}
