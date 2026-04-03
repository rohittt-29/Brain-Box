const mongoose = require('mongoose');
const Item = require('../models/Item');
const { generateEmbedding } = require('../utils/embedding');

// ── LLM CONFIG ──────────────────────────────────────────────────────────────
const GEMINI_MODELS = [
  'gemini-2.5-flash'
];

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_FALLBACK_MODELS = [
  'openchat/openchat-7b:free'
];

// ── GEMINI CALL ─────────────────────────────────────────────────────────────
async function tryGeminiModel(apiKey, modelName, systemPrompt, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\nUser Question:\n${userMessage}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (res.ok) {
    const answer = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (answer) return { answer, model: modelName };
    throw new Error('Empty response from Gemini');
  }

  throw new Error(
    `Gemini ${modelName} → HTTP ${res.status}: ${
      json?.error?.message || JSON.stringify(json).slice(0, 150)
    }`
  );
}

// ── LLM ROUTER ──────────────────────────────────────────────────────────────
async function callLLM(systemPrompt, userMessage) {
  const geminiKey = process.env.GEMINI_API_KEY;

  // ✅ Try Gemini first
  if (geminiKey) {
    for (const modelName of GEMINI_MODELS) {
      try {
        const result = await tryGeminiModel(
          geminiKey,
          modelName,
          systemPrompt,
          userMessage
        );
        console.log(`[ChatController] Gemini ${modelName} success`);
        return result;
      } catch (err) {
        console.warn(`[ChatController] Gemini ${modelName} failed:`, err.message);
      }
    }
  }

  // 🟡 Fallback → OpenRouter
  const orKey = process.env.OPENROUTER_API_KEY;

  if (orKey) {
    for (const model of OPENROUTER_FALLBACK_MODELS) {
      try {
        const res = await fetch(OPENROUTER_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${orKey}`,
            'HTTP-Referer': 'http://localhost:5173',
            'X-Title': 'BrainBox',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        const json = await res.json();

        if (res.ok) {
          const answer = json?.choices?.[0]?.message?.content;
          if (answer) {
            console.log(`[ChatController] OpenRouter ${model} success`);
            return { answer, model };
          }
        }

        console.warn(
          `[ChatController] OpenRouter ${model} failed: ${
            json?.error?.message || `HTTP ${res.status}`
          }`
        );
      } catch (err) {
        console.warn(`[ChatController] OpenRouter ${model} threw:`, err.message);
      }
    }
  }

  throw new Error('All LLM providers exhausted.');
}

// ── MAIN CONTROLLER ─────────────────────────────────────────────────────────
exports.askAI = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const userMessage = message.trim();

  // ── A: Embedding ─────────────────────────────────────────────────────────
  let queryVector = null;

  try {
    const vec = await generateEmbedding(userMessage);

    if (Array.isArray(vec) && vec.length === 384) {
      queryVector = vec;
    } else {
      console.warn(`[Embedding] Invalid dimensions: ${vec?.length}`);
    }
  } catch (err) {
    console.warn('[Embedding error]:', err.message);
  }

  // ── B: Vector Search ─────────────────────────────────────────────────────
  let results = [];

  if (queryVector) {
    try {
      results = await Item.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector,
            numCandidates: 100,
            limit: 5,
            filter: {
              userId: new mongoose.Types.ObjectId(req.user.id),
            },
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            content: 1,
            url: 1,
            type: 1,
            tags: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ]);

      // ✅ Filter low-quality matches
      // results = results.filter(r => r.score > 0.7);

      console.log(`[ChatController] Vector search returned ${results.length} results`);
    } catch (err) {
      console.warn('[Vector search failed]:', err.message);
    }
  }

  // ── C: Context Build ─────────────────────────────────────────────────────
  let context = '';

  if (results.length > 0) {
    context = results
      .map((item, i) => {
        return `[Note ${i + 1}]
Title: ${item.title || 'Untitled'}
Content: ${(item.content || '').slice(0, 500)}
URL: ${item.url || 'N/A'}`;
      })
      .join('\n\n---\n\n');
  }

  // ── D: Prompt ────────────────────────────────────────────────────────────
  // ── D: Prompt ────────────────────────────────────────────────────────────
  const systemPrompt = context
    ? `You are BrainBox AI.

You MUST answer using the user's saved notes provided below.

Saved Notes:
${context}

Instructions:
- Always use the notes above to answer
- Do NOT say "I don't have access"
- If relevant notes exist, answer from them
- If partial info, combine with your knowledge
- Keep answer helpful and direct

Now answer the user's question.` 
    : "You are BrainBox AI. Answer the user's question directly."; // Added a fallback prompt if context is empty

  // ── E: LLM Call ─────────────────────────────────────────────────────────
  try {
    const { answer, model } = await callLLM(systemPrompt, userMessage);

    return res.json({
      answer,
      model,
      sourceCount: results.length,
      sources: results,
    });
  } catch (err) {
    console.error('[LLM failed]:', err.message);

    return res.status(500).json({
      error: 'AI failed',
      sources: results,
    });
  }
};