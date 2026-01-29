const { GOOGLE_API_KEYS, AI_PROVIDER, OLLAMA_BASE_URL, OLLAMA_MODEL } = require('../../config/settings');
const fetch = require('node-fetch');

// Round-robin rotation
let currentKeyIndex = 0;
function getNextKey() {
    if (!GOOGLE_API_KEYS || GOOGLE_API_KEYS.length === 0) return null;
    const key = GOOGLE_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GOOGLE_API_KEYS.length;
    return key;
}

// Rate limit helper: ~15 RPM PER KEY.
// With N keys, we can go N times faster.
// We relax the sleep to 1000ms (generic safety) instead of 5000ms.
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callOllama(prompt, log = console.log, jsonMode = false) {
    const endpoint = `${OLLAMA_BASE_URL}/api/generate`;
    const payload = {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        format: jsonMode ? 'json' : undefined
    };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.text();
            log(`[Ollama] Error ${res.status}: ${err.substring(0, 100)}`);
            return null;
        }

        const data = await res.json();
        return data.response ? data.response.trim() : null;
    } catch (e) {
        log(`[Ollama] Exception: ${e.message}`);
        return null;
    }
}

/**
 * Generates an Italian description using Google Gemini
 * @param {string} title Original Title
 * @param {number} year Release Year
 * @param {string} currentDesc Current (English/bad) description to translate/improve
 * @returns {Promise<string|null>} The generated description or null
 */
async function generateDescription(title, year, currentDesc, log = console.log) {
    if (AI_PROVIDER === 'ollama') {
        const prompt = `Write a compelling summary in Italian for the movie/series "${title}" (${year}). ` +
            (currentDesc ? `Here is the English plot to translate and improve: "${currentDesc}".` : `I don't have a plot, please find one from your knowledge base.`) +
            ` Keep it under 300 characters. Output ONLY the Italian text.`;
        return callOllama(prompt, log);
    }

    const apiKey = getNextKey();
    if (!apiKey) return null;
    await sleep(1000);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const prompt = `Write a compelling summary in Italian for the movie/series "${title}" (${year}). ` +
        (currentDesc ? `Here is the English plot to translate and improve: "${currentDesc}".` : `I don't have a plot, please find one from your knowledge base.`) +
        ` Keep it under 300 characters. Output ONLY the Italian text.`;

    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.text();
            log(`[GoogleAI] Error ${res.status}: ${err.substring(0, 100)}`);
            return null;
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            log(`[GoogleAI] Generated description for ${title}`);
            return text.trim();
        }
    } catch (e) {
        log(`[GoogleAI] Exception: ${e.message}`);
    }
    return null;
}

/**
 * Translates text using Google Gemini
 * @param {string} text Text to translate
 * @param {string} targetLang Target Language (e.g. 'English', 'Italian')
 * @returns {Promise<string|null>} Translated text
 */
async function translateText(text, targetLang, log = console.log) {
    if (AI_PROVIDER === 'ollama') {
        const prompt = `Translate the following text to ${targetLang}. Output ONLY the translated text, no explanations: "${text}"`;
        return callOllama(prompt, log);
    }

    const apiKey = getNextKey();
    if (!apiKey || !text) return null;
    await sleep(1000);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const prompt = `Translate the following text to ${targetLang}. Output ONLY the translated text, no explanations: "${text}"`;

    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.text();
            log(`[GoogleAI] Translate Error ${res.status}: ${err}`);
            return null;
        }

        const data = await res.json();
        const translated = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!translated) {
            log(`[GoogleAI] No text in response: ${JSON.stringify(data)}`);
        }

        return translated ? translated.trim() : null;
    } catch (e) {
        log(`[GoogleAI] Translation Exception: ${e.message}`);
        return null;
    }
}

async function fixMetadataWithAI(title, year, currentDesc, log = console.log) {
    const safePrompt = `
    You are a metadata assistant.
    Input: Title="${title}", Year=${year}, Desc="${currentDesc || ''}".
    
    Rules:
    1. Title: If Asian characters present, translate to English. Otherwise return null.
    2. Description: Write a compelling summary in Italian (max 300 chars).
    
    Output strictly VALID JSON:
    { "title": "English Title OR null", "description": "Italian Description" }
    `;

    if (AI_PROVIDER === 'ollama') {
        const jsonText = await callOllama(safePrompt, log, true);
        if (!jsonText) return { title: null, description: null };
        try {
            const json = JSON.parse(jsonText);
            return {
                title: json.title === 'null' ? null : json.title,
                description: json.description
            };
        } catch (e) {
            log(`[Ollama] JSON Parse Error: ${e.message}`);
            return { title: null, description: null };
        }
    }

    const apiKey = getNextKey();
    if (!apiKey) return { title: null, description: null };
    await sleep(1000);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: safePrompt }]
        }]
    };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            if (res.status === 429) {
                log(`[GoogleAI] Rate Limit (429) hit.`);
                return { title: null, description: null, error: 429 };
            }
            const err = await res.text();
            log(`[GoogleAI] Error ${res.status}: ${err.substring(0, 100)}`);
            return { title: null, description: null };
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return { title: null, description: null };

        const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(jsonText);

        return {
            title: json.title === 'null' ? null : json.title,
            description: json.description
        };

    } catch (e) {
        log(`[GoogleAI] Exception: ${e.message}`);
        return { title: null, description: null };
    }
}

async function analyzeGenreWithAI(title, description, keywords, log = console.log) {
    // Only support Ollama for this new feature for now, or fallback to Google if needed, but user asked for Ollama.
    // We'll support both if keys present, but prioritize based on settings.

    const prompt = `
    Analyze this movie execution to see if it fits the "Animal Horror" subgenre.
    "Animal Horror" means the primary antagonist or threat is an animal (including mammals, reptiles, insects, arachnids, fish/sharks, birds, etc.) attacking humans.
    
    Title: "${title}"
    Description: "${description}"
    Keywords: "${keywords}"
    
    Return strictly JSON:
    { "isAnimalHorror": boolean, "rationale": "short explanation" }
    `;

    let responseText = null;

    if (AI_PROVIDER === 'ollama') {
        responseText = await callOllama(prompt, log, true);
    } else {
        // Fallback to Google if configured (re-using logic inline or helper if we refactored fully, but keeping simple)
        const apiKey = getNextKey();
        if (apiKey) {
            await sleep(1000); // Rate limit
            // ... implementation similar to above ...
            // Since this is a new feature, let's strictly use Ollama as requested by "use our ai_network instead" logic
            // unless we want to support both. For now, strict Ollama for this specific new feature if provider is ollama.
            if (AI_PROVIDER !== 'ollama') log('[GenreAI] Animal Horror check skipped: provider not ollama');
            return null;
        }
    }

    if (!responseText) return null;

    try {
        const json = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
        return json;
    } catch (e) {
        log(`[GenreAI] Error parsing JSON: ${e.message} | Response: ${responseText}`);
        return null;
    }
}

/**
 * Generic content analysis using the configured AI provider.
 * @param {string} title 
 * @param {string} description 
 * @param {string} keywords 
 * @param {string} instruction Specific instruction for the AI (e.g. "Identify the mood")
 * @param {boolean} jsonMode Whether to request/parse JSON
 * @param {Function} log 
 */
async function analyzeContent(title, description, keywords, instruction, jsonMode = false, log = console.log) {
    const prompt = `
    Analyze this content:
    Title: "${title}"
    Description: "${description}"
    Keywords: "${keywords}"
    
    Instruction: ${instruction}
    `;

    if (AI_PROVIDER === 'ollama') {
        const res = await callOllama(prompt, log, jsonMode);
        if (jsonMode && res) {
            try { return JSON.parse(res.replace(/```json/g, '').replace(/```/g, '').trim()); }
            catch (e) { log(`[AI] JSON Parse Error: ${e.message}`); return null; }
        }
        return res;
    }

    // Fallback/Legacy Google support for this new generic function
    const apiKey = getNextKey();
    if (!apiKey) return null;
    await sleep(1000);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) return null;
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        if (jsonMode) {
            try { return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()); }
            catch (e) { return null; }
        }
        return text.trim();
    } catch (e) {
        log(`[AI] Exception: ${e.message}`);
        return null;
    }
}

/**
 * Batch analysis for Animal Terror catalog
 * @param {Array<{id: number, title: string, overview: string, keywords: string}>} movies List of movies
 * @param {Function} log Logger
 */
async function analyzeAnimalTerrorBatch(movies, log = console.log) {
    if (!movies || movies.length === 0) return [];

    const prompt = `
    You are a specialized film archivist for the "Animal Terror" genre.
    
    **Definition of Animal Terror:**
    1. A movie or TV series where animals (mammals, birds, insects, reptiles, aquatic life) or mutant/supernatural creatures modeled after animals act as the primary antagonist or source of terror.
    2. The animals must be terrorizing, hunting, or attacking humans or humanity.
    3. This includes: Natural predators (Jaws), swarms (The Birds), genetically modified animals (Deep Blue Sea), or humans using animals as weapons/tools for terror.

    **Exclude:**
    * Cartoons/Family movies where animals are friendly (unless specifically attacking in horror context).
    * Documentaries.
    * Metaphorical "monsters" (unless physical creature features).
    * Fantasy/Sci-Fi where the "animal" is just incidental background.

    **Task:**
    Analyze the provided movie list. Return ONLY a JSON array of the IDs for movies that strictly fit this criteria.

    **Input Movies:**
    ${JSON.stringify(movies)}

    **Output Format:**
    [123, 456]
    `;

    if (AI_PROVIDER === 'ollama') {
        const res = await callOllama(prompt, log, true);
        if (res) {
            try { return JSON.parse(res.replace(/```json/g, '').replace(/```/g, '').trim()); }
            catch (e) { log(`[AI] JSON Parse Error: ${e.message}`); return []; }
        }
        return [];
    }

    // Google Fallback
    const apiKey = getNextKey();
    if (!apiKey) return [];
    await sleep(2000); // Higher sleep for batch

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
            log(`[BatchAI] Error ${res.status}`);
            return [];
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return [];
        try {
            return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) { return []; }
    } catch (e) {
        log(`[BatchAI] Exception: ${e.message}`);
        return [];
    }
}

/**
 * Batch analysis for Virus catalog
 * @param {Array<{id: number, title: string, overview: string, keywords: string}>} movies List of movies
 * @param {Function} log Logger
 */
async function analyzeVirusBatch(movies, log = console.log) {
    if (!movies || movies.length === 0) return [];

    const prompt = `
    You are a film analyst specializing in the "Virus & Outbreak" genre.
    
    **Inclusion Criteria:**
    1. **Scale:** The disease must affect a large group (a town, a city, or global). It must be an epidemic or pandemic.
    2. **Threat:** The narrative focus must be on the spread, the search for a cure, the societal collapse, or the survival against the biological agent.
    3. **Zombies:** Include if the zombie outbreak is explicitly caused by a virus or biological infection (e.g. 28 Days Later, Resident Evil).

    **Strict Exclusions:**
    * Personal medical dramas about a single person's illness (e.g. Philadelphia, A Walk to Remember).
    * Documentaries about real-world diseases.
    * Supernatural curses (unless they behave exactly like a biological contagion).

    **Task:**
    Analyze the provided list of movies/series. Return ONLY a JSON array of the IDs for items that strictly fit this criteria.

    **Input Movies:**
    ${JSON.stringify(movies)}

    **Output Format:**
    [123, 456]
    `;

    if (AI_PROVIDER === 'ollama') {
        const res = await callOllama(prompt, log, true);
        if (res) {
            try { return JSON.parse(res.replace(/```json/g, '').replace(/```/g, '').trim()); }
            catch (e) { log(`[AI] JSON Parse Error: ${e.message}`); return []; }
        }
        return [];
    }

    // Google Fallback
    const apiKey = getNextKey();
    if (!apiKey) return [];
    await sleep(2000); // Higher sleep for batch

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
            log(`[BatchAI] Error ${res.status}`);
            return [];
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return [];
        try {
            return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) { return []; }
    } catch (e) {
        log(`[BatchAI] Exception: ${e.message}`);
        return [];
    }
}

/**
 * Batch analysis for Supernatural catalog
 * @param {Array<{id: number, title: string, overview: string, keywords: string}>} movies List of movies
 * @param {Function} log Logger
 */
async function analyzeSupernaturalBatch(movies, log = console.log) {
    if (!movies || movies.length === 0) return [];

    const prompt = `
    You are a specialist in the "Supernatural" film genre. Your goal is to identify movies or series where the plot is centered on phenomena that defy scientific explanation and involve the ethereal, the occult, or the undead.
    
    **Inclusion Criteria:**
    1. **Entities:** Ghosts, demons, spirits, vengeful souls, or evil entities.
    2. **Occult/Witchcraft:** Witches, satanic rituals, ouija boards, hexes, and dark magic.
    3. **The Unseen:** Poltergeists, spiritual infestations, or hauntings of locations/people.
    4. **Supernatural Control:** Include cases where a supernatural entity controls animals or humans to wreak havoc (e.g. The Birds is natural terror, but a movie where a demon controls a dog is Supernatural).

    **Strict Exclusions:**
    * Generic "slasher" movies with human killers (e.g. Scream).
    * Sci-fi movies where the "monster" is an alien or biological experiment (e.g. Alien, Jurassic Park).
    * Fantasy worlds where everyone has magic (e.g. Harry Potter), unless the focus is specifically on a horror-centric supernatural threat.

    **Task:**
    Analyze the provided list and return ONLY a JSON array of IDs for items that strictly fit this criteria.

    **Input Format:**
    ${JSON.stringify(movies)}

    **Output Format:**
    [789, 101, 202]
    `;

    if (AI_PROVIDER === 'ollama') {
        const res = await callOllama(prompt, log, true);
        if (res) {
            try { return JSON.parse(res.replace(/```json/g, '').replace(/```/g, '').trim()); }
            catch (e) { log(`[AI] JSON Parse Error: ${e.message}`); return []; }
        }
        return [];
    }

    // Google Fallback
    const apiKey = getNextKey();
    if (!apiKey) return [];
    await sleep(2000); // Higher sleep for batch

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
            log(`[BatchAI] Error ${res.status}`);
            return [];
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return [];
        try {
            return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) { return []; }
    } catch (e) {
        log(`[BatchAI] Exception: ${e.message}`);
        return [];
    }
}

/**
 * Batch analysis for Apocalypse catalog
 * @param {Array<{id: number, title: string, overview: string, keywords: string}>} movies List of movies
 * @param {Function} log Logger
 */
async function analyzeApocalypseBatch(movies, log = console.log) {
    if (!movies || movies.length === 0) return [];

    const prompt = `
    You are a specialist in Apocalyptic and Post-Apocalyptic cinema. Your goal is to identify movies that depict the prelude to, the event of, or the aftermath of a world-ending catastrophe.
    
    **Inclusion Criteria:**
    1. **Scale:** The threat must be existential to humanity or a massive portion of civilization.
    2. **Timeline:**
       * **Prelude:** The hours or days leading up to an inevitable end (e.g., Seeking a Friend for the End of the World, Melancholia).
       * **The Event:** The actual collapse of society as it happens (e.g., 2012, Greenland, War of the Worlds).
       * **Post-Apocalypse:** Life in a world that has already collapsed (e.g., Mad Max, The Road, The Book of Eli, Fallout).
    3. **Causes:** Nuclear war, environmental collapse, celestial impacts (asteroids), global pandemics, or supernatural "Judgment Day" events.

    **Strict Exclusions:**
    * Isolated survival stories (e.g., Cast Away).
    * Small-scale disaster movies where the world returns to normal afterward (e.g., Twister, Dante's Peak).
    * Dystopias that are functioning societies, even if oppressive (e.g., The Hunger Games, 1984), UNLESS they are set in the ruins of the old world.

    **Task:**
    Analyze the provided movie list. Return ONLY a JSON array of the IDs for movies that strictly fit this criteria.

    **Input Format:**
    ${JSON.stringify(movies)}

    **Output Format:**
    [123, 456, 789]
    `;

    if (AI_PROVIDER === 'ollama') {
        const res = await callOllama(prompt, log, true);
        if (res) {
            try { return JSON.parse(res.replace(/```json/g, '').replace(/```/g, '').trim()); }
            catch (e) { log(`[AI] JSON Parse Error: ${e.message}`); return []; }
        }
        return [];
    }

    // Google Fallback
    const apiKey = getNextKey();
    if (!apiKey) return [];
    await sleep(2000); // Higher sleep for batch

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
            log(`[BatchAI] Error ${res.status}`);
            return [];
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return [];
        try {
            return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) { return []; }
    } catch (e) {
        log(`[BatchAI] Exception: ${e.message}`);
        return [];
    }
}

/**
 * Normalize a slugified title using AI
 * Fixes issues like "Ginny And Georgia" → "Ginny & Georgia", "Greys Anatomy" → "Grey's Anatomy"
 * @param {string} rawTitle The slugified title from URL
 * @param {Function} log Logger
 * @returns {Promise<string>} The normalized title, or original if AI fails
 */
async function normalizeTitle(rawTitle, log = console.log) {
    if (!rawTitle) return rawTitle;

    const prompt = `You are a movie/TV title expert. Fix this slugified title to its proper form with correct punctuation, apostrophes, and characters.

Input: "${rawTitle}"

Rules:
1. Fix apostrophes: "Greys Anatomy" → "Grey's Anatomy", "Its Always Sunny" → "It's Always Sunny"
2. Fix ampersands: "Law And Order" → "Law & Order"
3. Fix Roman numerals and special chars
4. If Italian title, keep it Italian but fix formatting
5. Common fixes: "Pd" → "P.D.", "Tv" → "TV"

Output ONLY the corrected title, nothing else.`;

    if (AI_PROVIDER === 'ollama') {
        const result = await callOllama(prompt, log);
        if (result && result.length < 200) { // Sanity check
            return result.trim().replace(/^["']|["']$/g, ''); // Remove quotes if AI added them
        }
        return rawTitle;
    }

    // Google fallback
    const apiKey = getNextKey();
    if (!apiKey) return rawTitle;
    await sleep(500); // Lighter rate limit for quick lookups

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) return rawTitle;
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.length < 200) {
            return text.trim().replace(/^["']|["']$/g, '');
        }
    } catch (e) {
        log(`[AI] Title normalize error: ${e.message}`);
    }
    return rawTitle;
}

/**
 * Batch normalize titles using AI (more efficient for multiple titles)
 * @param {string[]} rawTitles Array of slugified titles
 * @param {Function} log Logger
 * @returns {Promise<Object>} Map of original → normalized titles
 */
async function normalizeTitlesBatch(rawTitles, log = console.log) {
    if (!rawTitles || rawTitles.length === 0) return {};

    // Limit batch size to avoid token limits
    const batchSize = 20;
    const results = {};

    for (let i = 0; i < rawTitles.length; i += batchSize) {
        const batch = rawTitles.slice(i, i + batchSize);

        const prompt = `You are a movie/TV title expert. Fix these slugified titles to their proper forms.

Input titles (one per line):
${batch.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}

Rules:
1. Fix apostrophes: "Greys Anatomy" → "Grey's Anatomy"
2. Fix ampersands: "Law And Order" → "Law & Order"  
3. Fix formatting: "Chicago Pd" → "Chicago P.D."
4. If Italian, keep Italian but fix punctuation

Output as JSON object mapping original to corrected:
{"Greys Anatomy": "Grey's Anatomy", "Law And Order": "Law & Order"}`;

        let responseText = null;

        if (AI_PROVIDER === 'ollama') {
            responseText = await callOllama(prompt, log, true);
        } else {
            const apiKey = getNextKey();
            if (apiKey) {
                await sleep(1000);
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
                const payload = { contents: [{ parts: [{ text: prompt }] }] };
                try {
                    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (res.ok) {
                        const data = await res.json();
                        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    }
                } catch (e) { log(`[AI] Batch normalize error: ${e.message}`); }
            }
        }

        if (responseText) {
            try {
                const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                Object.assign(results, parsed);
            } catch (e) {
                log(`[AI] Batch JSON parse error: ${e.message}`);
                // Fallback: use originals
                batch.forEach(t => results[t] = t);
            }
        } else {
            batch.forEach(t => results[t] = t);
        }
    }

    return results;
}

module.exports = { generateDescription, translateText, fixMetadataWithAI, analyzeGenreWithAI, analyzeContent, analyzeAnimalTerrorBatch, analyzeVirusBatch, analyzeSupernaturalBatch, analyzeApocalypseBatch, normalizeTitle, normalizeTitlesBatch };
