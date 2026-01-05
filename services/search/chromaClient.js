const fetch = require('node-fetch');
const { AI_PROVIDER, OLLAMA_BASE_URL, OLLAMA_MODEL } = require('../../config/settings');

// Constants
const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const COLLECTION_NAME = 'media_embeddings';
const SEARCH_API_URL = process.env.SEARCH_API_URL || 'http://search-api:8080';

// Configuration
// If Search API is present, we prefer it for embeddings as it's likely optimized (SentenceTransformers).
// If not, we fall back to Ollama embeddings.
const USE_SEARCH_API = true; // Set to true if search-api container is deployed

async function getEmbedding(text) {
    if (!text) return null;

    // Option 1: Search API (Preferred for standard embeddings)
    if (USE_SEARCH_API) {
        try {
            const res = await fetch(`${SEARCH_API_URL}/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (res.ok) {
                const data = await res.json();
                return data.embedding; // Assumes { embedding: [0.1, ...] } format
            }
        } catch (e) {
            // console.warn(`[Chroma] Search API embed failed: ${e.message}. Trying Ollama...`);
        }
    }

    // Option 2: Ollama Embeddings
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: text
            })
        });
        if (res.ok) {
            const data = await res.json();
            return data.embedding;
        }
    } catch (e) {
        console.error(`[Chroma] Embedding failed: ${e.message}`);
    }
    return null;
}

// Ensure collection exists
async function ensureCollection() {
    try {
        const checkRes = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}`);
        if (checkRes.ok) return;

        // Create
        await fetch(`${CHROMA_URL}/api/v1/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: COLLECTION_NAME, metadata: { "hnsw:space": "cosine" } })
        });
        console.log(`[Chroma] Collection '${COLLECTION_NAME}' created.`);
    } catch (e) {
        console.error(`[Chroma] Init error: ${e.message}`);
    }
}

// Add item
async function upsertItem(id, text, metadata) {
    const embedding = await getEmbedding(text);
    if (!embedding) return false;

    try {
        const payload = {
            ids: [String(id)],
            embeddings: [embedding],
            metadatas: [metadata],
            documents: [text]
        };

        const res = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (e) {
        console.error(`[Chroma] Upsert error: ${e.message}`);
        return false;
    }
}

// Search
async function search(query, limit = 10) {
    const embedding = await getEmbedding(query);
    if (!embedding) return [];

    try {
        const payload = {
            query_embeddings: [embedding],
            n_results: limit
        };

        const res = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) return [];

        const data = await res.json();
        const ids = data.ids?.[0] || [];
        const distances = data.distances?.[0] || [];

        return ids.map((id, idx) => ({
            id,
            score: 1 - (distances[idx] || 0) // Cosine distance to similarity
        }));

    } catch (e) {
        console.error(`[Chroma] Search error: ${e.message}`);
        return [];
    }
}

module.exports = { ensureCollection, upsertItem, search };
