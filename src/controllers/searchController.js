const Item = require('../models/Item');
const { generateEmbedding, calculateCosineSimilarity } = require('../utils/embedding');

/**
 * Performs semantic search on user's items using vector embeddings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.semanticSearch = async (req, res, next) => {
  try {
    const { query } = req.body;
    
    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ 
        message: 'Query is required and must be a non-empty string' 
      });
    }
    
    const trimmedQuery = query.trim();
    
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(trimmedQuery);
    
    // Fetch all items for the logged-in user
    const userItems = await Item.find({ 
      userId: req.user.id,
      embedding: { $exists: true, $ne: [] } // Only items with embeddings
    });
    
    if (userItems.length === 0) {
      return res.json({
        query: trimmedQuery,
        results: [],
        totalResults: 0,
        message: 'No items with embeddings found for semantic search'
      });
    }
    
    // Calculate cosine similarity between query and each item
    const itemsWithSimilarity = userItems.map(item => {
      const cosine = calculateCosineSimilarity(queryEmbedding, item.embedding);
      // Normalize cosine (-1..1) to 0..1 for easier interpretation
      const normalized = (cosine + 1) / 2;
      return {
        ...item.toObject(),
        similarity: normalized
      };
    });
    
    // Sort by similarity (highest first) and return up to top 20
    const topResults = itemsWithSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20)
      .map(item => {
        // Remove embedding from response to reduce payload size
        const { embedding, ...itemWithoutEmbedding } = item;
        return {
          ...itemWithoutEmbedding,
          similarity: item.similarity
        };
      });
    
    return res.json({
      query: trimmedQuery,
      results: topResults,
      totalResults: topResults.length,
      totalItemsSearched: userItems.length
    });
    
  } catch (error) {
    console.error('Semantic search error:', error);
    return next(error);
  }
};

/**
 * Reindex all items' embeddings for the logged-in user.
 * This rebuilds embeddings using content/title/url/tags so future searches include tags.
 */
exports.reindexEmbeddings = async (req, res, next) => {
  try {
    const items = await Item.find({ userId: req.user.id });
    let updatedCount = 0;
    for (const item of items) {
      const tagText = Array.isArray(item.tags) ? item.tags.join(' ') : ''
      const textForEmbedding = (item.content && item.content.trim().length > 0)
        ? item.content
        : `${item.title || ''} ${item.url || ''} ${tagText}`.trim();
      if (!textForEmbedding) continue;
      const embedding = await generateEmbedding(textForEmbedding);
      item.embedding = embedding;
      await item.save();
      updatedCount += 1;
    }
    return res.json({ message: 'Reindex complete', updated: updatedCount, total: items.length });
  } catch (error) {
    return next(error);
  }
}