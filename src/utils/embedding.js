/**
 * Embedding utility: 100% LOCAL embeddings using @xenova/transformers.
 * Model: Xenova/all-MiniLM-L6-v2  →  384 dimensions, no API key required.
 * The model (~90 MB) is downloaded from HuggingFace on first use and cached locally.
 */

// Lazily-initialized pipeline — avoids re-loading the model on every call
let _pipeline = null;

async function getEmbeddingPipeline() {
  if (!_pipeline) {
    // @xenova/transformers is ESM-only; use dynamic import in CommonJS
    const { pipeline, env } = await import('@xenova/transformers');

    // Suppress verbose progress logs in production
    env.allowLocalModels = false;

    console.log('[Embedding] Loading Xenova/all-MiniLM-L6-v2 (first load — downloads ~90MB) ...');
    _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('[Embedding] Model ready.');
  }
  return _pipeline;
}

/**
 * Deterministic fallback when model is still loading or an error occurs.
 * Produces a 384-dim pseudo-vector (not semantic, but stable for a given text).
 */
function deterministicFallbackEmbedding(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return new Array(384).fill(0);
  const arr = new Array(384).fill(0);
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    arr[i % 384] += (code % 97) / 50 - 1;
  }
  const mag = Math.sqrt(arr.reduce((s, v) => s + v * v, 0)) || 1;
  return arr.map((v) => v / mag);
}

/**
 * Generates a 384-dimensional embedding vector for the given text.
 * Uses the local Xenova/all-MiniLM-L6-v2 model — no API key required.
 * @param {string} text
 * @returns {Promise<number[]>}  Always resolves (falls back on error).
 */
async function generateEmbedding(text) {
  try {
    const trimmed = String(text || '').trim();
    if (!trimmed) return new Array(384).fill(0);

    const pipe = await getEmbeddingPipeline();
    // pooling='mean' + normalize=true → unit-length 384-dim vector
    const output = await pipe(trimmed, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (err) {
    console.error('[Embedding] Error generating embedding, using fallback:', err.message);
    return deterministicFallbackEmbedding(text);
  }
}

/**
 * Cosine similarity between two equal-length embedding vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Score between -1 and 1.
 */
function calculateCosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  return magA && magB ? dot / (magA * magB) : 0;
}

module.exports = { generateEmbedding, calculateCosineSimilarity };
