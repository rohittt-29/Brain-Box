/**
 * Embedding utility (production-ready): uses OpenAI embeddings if OPENAI_API_KEY is set,
 * otherwise falls back to a deterministic placeholder.
 */

/**
 * Normalize a vector to unit length for cosine similarity.
 */
function normalizeVector(vec) {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vec.map((v) => v / magnitude);
}

function deterministicFallbackEmbedding(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  const dim = 384;
  const arr = new Array(dim).fill(0);
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    arr[i % dim] += (code % 97) / 50 - 1; // spread chars across dims
  }
  return normalizeVector(arr);
}

/**
 * Generates a vector embedding for the given text.
 * Prefers OpenAI `text-embedding-3-small` if OPENAI_API_KEY is available.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
  try {
    const trimmed = String(text || '').trim();
    if (!trimmed) return [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      // Use native fetch (Node 18+) to avoid extra deps
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: trimmed,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const vector = json?.data?.[0]?.embedding;
        if (Array.isArray(vector) && vector.length > 0) {
          return normalizeVector(vector.map((n) => Number(n) || 0));
        }
        console.error('OpenAI embedding error: invalid vector');
      } else {
        const errBody = await res.text();
        console.error('OpenAI embedding error:', res.status, errBody);
      }
      // Fallback if OpenAI failed (quota, network, etc.)
      return deterministicFallbackEmbedding(trimmed);
    }

    // Fallback: deterministic pseudo-embedding from text (still not semantic, but stable)
    // This is just to avoid total failure when API key is missing.
    return deterministicFallbackEmbedding(trimmed);
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Final safety fallback: never throw, always return a deterministic vector
    return deterministicFallbackEmbedding(text);
  }
}

/**
 * Calculates cosine similarity between two embedding vectors
 * @param {number[]} embedding1 - First embedding vector
 * @param {number[]} embedding2 - Second embedding vector
 * @returns {number} - Cosine similarity score between -1 and 1
 */
function calculateCosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embedding vectors must have the same length');
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

module.exports = {
  generateEmbedding,
  calculateCosineSimilarity
};
