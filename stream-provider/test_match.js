const { findBestMatch } = require('./services/streams/utils/matcher');

// Mock Data
const candidates = [
    { title: "The Avengers (2012)", id: 1 },
    { title: "Avengers: Age of Ultron", id: 2 },
    { title: "Avengers S01E01", id: 3 }, // Should be rejected for movie
    { title: "Limitless", id: 4 }, // Movie
    { title: "Limitless S01", id: 5 }, // Series
    { title: "Matrix, The", id: 6 }
];

console.log("--- Test 1: Fuzzy Matching 'The Avngers' (Movie) ---");
const match1 = findBestMatch("The Avngers", candidates, 'movie'); // Typo intentional
console.log("Match:", match1 ? match1.title : "None");

console.log("\n--- Test 2: Safeguard 'Avengers' (Movie) ---");
// Should pick movie, reject series S01E01 if score is high for series?
// Query: "Avengers"
// "The Avengers (2012)" score ~90
// "Avengers S01E01" score ~80 (partial)
// Logic should just ignore the series one.
const match2 = findBestMatch("Avengers", candidates, 'movie');
console.log("Match:", match2 ? match2.title : "None");

console.log("\n--- Test 3: Safeguard 'Limitless' (Movie) ---");
// Query: "Limitless"
// Candidate 4: "Limitless" (Exact)
// Candidate 5: "Limitless S01" (Partial/High score)
// If we safeguard, Candidate 5 is rejected immediately.
const match3 = findBestMatch("Limitless", candidates, 'movie');
console.log("Match:", match3 ? match3.title : "None");

console.log("\n--- Test 4: 'Matrix' (Movie) matching 'Matrix, The' ---");
const match4 = findBestMatch("Matrix", candidates, 'movie');
console.log("Match:", match4 ? match4.title : "None");
