const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { askAI } = require('../controllers/chatController');

// All chat routes require authentication
router.use(auth);

/**
 * POST /api/chat/ask
 * Body: { message: string }
 * Returns: { answer: string, sourceCount: number, model: string }
 */
router.post('/ask', askAI);

module.exports = router;
