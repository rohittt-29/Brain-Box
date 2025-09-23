const express = require('express');
const router = express.Router();
const { semanticSearch, reindexEmbeddings } = require('../controllers/searchController');
const authenticateToken = require('../middleware/authMiddleware');

/**
 * Search Routes
 * All routes are protected with JWT authentication
 */

// POST /api/search - Semantic search endpoint
router.post('/', authenticateToken, semanticSearch);

// POST /api/search/reindex - Rebuild embeddings for current user's items
router.post('/reindex', authenticateToken, reindexEmbeddings);

module.exports = router;
