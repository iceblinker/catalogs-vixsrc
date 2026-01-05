
const fs = require('fs');
const tvRepo = require('../lib/db/repositories/tvRepository');

async function ingest() {
    console.log('Reading file...');
    const content = fs.readFileSync('Hercai - Amore e vendetta.txt', 'utf8');

    // The file seems to contain multiple JSON-like blocks or parts.
    // Based on the snippet, it has a "loadedSeason" object which contains "episodes".
    // Since there are multiple seasons, we need to extract all episodes relative to the show.

    // Regex to find "episodes" arrays.
    // The format in the text file looks like: "episodes": [ ... ]
    // But it's nested inside "loadedSeason" or "title".

    // Let's try to parse the file carefully. It looks like a dump of API responses.

    const episodes = [];

    // Simple approach: Find all "episodes": [ ... ] blocks and parse them if possible.
    // However, the file is huge. Simple regex or parsing might be fragile.
    // Let's look for objects with "number", "name", "season_id" inside an array.

    // Better approach: The file contains blocks like `"episodes": [` ... `]`.
    // We can try to extract those JSON arrays.

    // Hacky parser: iterate lines
    const lines = content.split('\n');
    let insideEpisodeBlock = false;
    let braceCount = 0;
    let currentBlock = '';

    // Let's just Regex for all episode objects.
    // Each episode object has "id", "number", "name", "plot", "season_id".
    // We want "number" (episode_number) and season information.
    // We might need to map "season_id" to a season number.
    // In the file:
    // Season 1 (id 5553) -> episodes [ ... ]
    // Season 2 (id 5937) -> episodes [ ... ]
    // Season 3 (id 7058) -> episodes [ ... ]

    // Let's extract the season map first.
    // "seasons": [ ... ]
    // We can search for the "seasons" block.

    const seasonMap = {}; // id -> number
    // Extract seasons block
    const seasonsMatch = content.match(/"seasons":\s*\[([\s\S]*?)\]/);
    if (seasonsMatch) {
        try {
            const seasonsJson = JSON.parse('[' + seasonsMatch[1] + ']');
            seasonsJson.forEach(s => {
                if (s.id && s.number) seasonMap[s.id] = s.number;
            });
            console.log('Season Map:', seasonMap);
        } catch (e) {
            console.log('Failed to parse seasons JSON directly, trying regex for seasons');
            // Fallback regex
            const idMatches = [...content.matchAll(/"id":\s*(\d+),\s*"number":\s*(\d+)/g)];
            // This is dangerous as it matches episodes too potentially.
            // Manual override based on file inspection:
            seasonMap[5553] = 1;
            seasonMap[5937] = 2;
            seasonMap[7058] = 3;
        }
    } else {
        // Manual Map fallback
        seasonMap[5553] = 1;
        seasonMap[5937] = 2;
        seasonMap[7058] = 3;
    }

    // Regex to find episode blocks
    // Format: 
    /*
      {
          "id": 71807,
          "number": 1,
          "name": "Destini incrociati",
          "plot": "...",
          ...
          "season_id": 5553,
          ...
      }
    */

    // We can regex for individual fields within curly braces? No, too messy.
    // Let's split by `"id":` and try to reconstruct?

    // Let's use a regex that captures the essential fields for an episode.
    // "number": (\d+),.*?"name": "(.*?)",.*?"plot": "(.*?)",.*?"season_id": (\d+)
    // We need "images" too if possible.

    // Actually, looking at the file snippet, it looks like valid JSON fragments.
    // Let's try to extract the big "episodes": [...] arrays.

    // Improved Parser using Brace Counting
    let allFoundEpisodes = [];
    // Find start indices of "episodes": [
    const searchStr = '"episodes": [';
    let startIndex = 0;

    while ((startIndex = content.indexOf(searchStr, startIndex)) !== -1) {
        // Point to the opening '['
        let currentIndex = startIndex + searchStr.length - 1;
        let bracketCount = 0;
        let extraction = '';

        // Start capturing from '['
        for (let i = currentIndex; i < content.length; i++) {
            const char = content[i];
            extraction += char;

            if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;

            if (bracketCount === 0) {
                // Found the matching closing bracket
                try {
                    const parsed = JSON.parse(extraction);
                    parsed.forEach(ep => {
                        // Inherit season_id from context? 
                        // The regex context was weak.
                        // Let's rely on ep.season_id if present, or guess based on sequence.
                        // The snippet shows each episode has "season_id".
                        if (ep.number && ep.name) {
                            allFoundEpisodes.push(ep);
                        }
                    });
                } catch (e) {
                    console.log('Failed to parse extracted block:', e.message);
                }
                break;
            }
        }
        startIndex += 1;
    }

    console.log(`Found ${allFoundEpisodes.length} raw episodes.`);

    // Map to Stremio format
    // We need tmdb_id = 87623
    const finalEpisodes = allFoundEpisodes.map(ep => {
        const seasonNum = seasonMap[ep.season_id] || 1; // Default to 1 if missing

        // Find image
        let still_path = null;
        if (ep.images && ep.images.length > 0) {
            // "filename": "..."
            // "https://cdn.streamingunity.so/images/" + filename
            still_path = '/t/p/w500/' + ep.images[0].filename; // This is weird. Stremio expects TMDB path format usually?
            // Wait, the user provided exact URL example: "https://cdn.streamingunity.so/images/3ebca28e...webp"
            // Our metaService uses `https://image.tmdb.org/t/p/w500${e.still_path}`
            // We need to bypass the TMDB prefix logic in metaService if we use custom URLs?
            // OR store the full URL in thumbnail and fix metaService to handle full URLs.
            // Wait, metaService line: `thumbnail: e.still_path ? \`https://image.tmdb.org/t/p/w500\${e.still_path}\` : null`
            // If I verify metaService, it forces the prefix.
            // I should modify metaService to verify if still_path starts with http.
        }

        return {
            season_number: seasonNum,
            episode_number: ep.number,
            name: ep.name,
            overview: ep.plot,
            air_date: null, // "release_date" in file? `release_date` seems null in snippet, verify if available somewhere.
            still_path: ep.images && ep.images[0] ? ep.images[0].filename : null, // Storing filename. We need to handle the URL prefix.
            custom_image_url: ep.images && ep.images[0] ? `https://cdn.streamingunity.so/images/${ep.images[0].filename}` : null
        };
    });

    // Dedupe
    const seen = new Set();
    const uniqueEpisodes = [];
    finalEpisodes.forEach(ep => {
        const key = `${ep.season_number}:${ep.episode_number}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueEpisodes.push(ep);
        }
    });

    console.log(`Unique episodes to ingest: ${uniqueEpisodes.length}`);

    if (uniqueEpisodes.length === 0) {
        console.log('No episodes found. Aborting.');
        return;
    }

    // Save to DB
    const tmdbId = 87623;
    const repoItem = tvRepo.getById(tmdbId);

    if (!repoItem) {
        console.log(`Show ${tmdbId} not found in DB. Need to create it or scrape it first.`);
        // Assuming it exists because user showed metadata.
        return;
    }

    console.log(`Updating Hercai (${tmdbId}) with custom episodes...`);

    // We need to store them in a format metaService understands.
    // metaService uses: season_number, episode_number, name, overview, air_date, still_path.
    // But metaService forces TMDB URL for still_path.
    // We will pass the FULL URL in a new field or trick it?
    // Let's store `still_path` as the full URL if we change metaService?
    // User wants these specific images.
    // I will add `still_path` as the filename, BUT I need to update metaService to use the CDN if it detects it's not a TMDB path?
    // Actually, simpler: I'll store the object with `still_path` as NULL and `thumbnail` as the full URL?
    // MetaService maps `e.still_path` to thumbnail.
    // `thumbnail: e.still_path ? ... : null`
    // I need to update metaService again to handle custom thumbnails.

    // Let's update the episodes JSON in DB.
    repoItem.episodes = JSON.stringify(uniqueEpisodes);
    tvRepo.save(repoItem);
    console.log('Done.');
}

ingest();
