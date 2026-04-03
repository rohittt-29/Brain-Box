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
    const { query, section } = req.body;
    const userId = req.user.id;

    // Base filter for user's items
    const baseFilter = { userId };
    if (section && section !== 'All Items') {
      baseFilter.type = section.toLowerCase();
    }

    // If no query, return all items for the section
    if (!query || !query.trim()) {
      const items = await Item.find(baseFilter).sort({ createdAt: -1 });
      return res.json({
        results: items,
        totalResults: items.length,
        query: '',
        section
      });
    }

    // Search setup
    const searchQuery = query.trim();
    const searchQueryLower = searchQuery.toLowerCase();
    const items = await Item.find(baseFilter);

    // Initialize results array
    let searchResults = [];

    // 1. First Priority: Exact title matches (case-insensitive)
    const exactTitleMatches = items.filter(item => {
      const title = String(item.title || '');
      return title.toLowerCase() === searchQueryLower;
    }).map(item => ({
      ...item.toObject(),
      score: 1.0,
      matchType: 'exact-title'
    }));
    searchResults.push(...exactTitleMatches);

    // 2. Second Priority: Exact tag matches (case-insensitive)
    const exactTagMatches = items.filter(item => {
      if (searchResults.find(r => r._id.toString() === item._id.toString())) return false;
      const tags = Array.isArray(item.tags) ? item.tags : [];
      return tags.some(tag => String(tag).toLowerCase() === searchQueryLower);
    }).map(item => ({
      ...item.toObject(),
      score: 0.9,
      matchType: 'exact-tag'
    }));
    searchResults.push(...exactTagMatches);

    // 3. Third Priority: Partial title matches
    const partialTitleMatches = items.filter(item => {
      if (searchResults.find(r => r._id.toString() === item._id.toString())) return false;
      const title = String(item.title || '');
      return title.toLowerCase().includes(searchQueryLower);
    }).map(item => ({
      ...item.toObject(),
      score: 0.8,
      matchType: 'partial-title'
    }));
    searchResults.push(...partialTitleMatches);

    // 4. Fourth Priority: Partial tag matches
    const partialTagMatches = items.filter(item => {
      if (searchResults.find(r => r._id.toString() === item._id.toString())) return false;
      const tags = Array.isArray(item.tags) ? item.tags : [];
      return tags.some(tag => String(tag).toLowerCase().includes(searchQueryLower));
    }).map(item => ({
      ...item.toObject(),
      score: 0.7,
      matchType: 'partial-tag'
    }));
    searchResults.push(...partialTagMatches);

    // 5. Fifth Priority: Content matches
    const contentMatches = items.filter(item => {
      if (searchResults.find(r => r._id.toString() === item._id.toString())) return false;
      const content = String(item.content || '');
      const url = String(item.url || '');
      return content.toLowerCase().includes(searchQueryLower) ||
             url.toLowerCase().includes(searchQueryLower);
    }).map(item => ({
      ...item.toObject(),
      score: 0.6,
      matchType: 'content'
    }));
    searchResults.push(...contentMatches);

    // 6. Last Resort: Semantic search (only if no other matches found)
    if (searchResults.length === 0) {
      try {
        const queryEmbedding = await generateEmbedding(searchQuery);
        const semanticMatches = items
          .filter(item => Array.isArray(item.embedding) && item.embedding.length > 0)
          .map(item => {
            try {
              const similarity = calculateCosineSimilarity(queryEmbedding, item.embedding);
              return {
                ...item.toObject(),
                score: similarity * 0.5, // Scale down semantic scores
                matchType: 'semantic'
              };
            } catch (error) {
              console.error('Error calculating similarity:', error);
              return null;
            }
          })
          .filter(Boolean) // Remove null results
          .filter(item => item.score > 0.15); // Only keep somewhat relevant matches

        searchResults.push(...semanticMatches);
      } catch (error) {
        console.error('Semantic search error:', error);
        // Continue without semantic results
      }
    }

    // Sort results by score and prepare final response
    const finalResults = searchResults
      .sort((a, b) => b.score - a.score)
      .map(item => {
        // Remove internal fields from response
        const { embedding, matchType, score, ...cleanItem } = item;
        return {
          ...cleanItem,
          similarity: score // Rename score to similarity for frontend compatibility
        };
      });

    return res.json({
      results: finalResults,
      totalResults: finalResults.length,
      query: searchQuery,
      section,
      searchType: finalResults.length > 0 ? 
        (searchResults[0].matchType === 'semantic' ? 'semantic' : 'text') : 
        'none'
    });

  } catch (error) {
    console.error('Search error:', error);
    next(error);
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
      const textForEmbedding = `${item.title || ''} ${item.content || ''} ${item.url || ''} ${tagText}`.trim();
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
};