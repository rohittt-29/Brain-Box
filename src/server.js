const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDb = require('./config/database');

dotenv.config();

const app = express();

app.use(express.json());
// Allow single or multiple comma-separated origins via CORS_ORIGIN
// In production, default to your Vercel domain only; in dev allow localhost
const defaultOrigins = (process.env.NODE_ENV === 'production')
  ? [
    "https://brain-box1.vercel.app",
    "https://brain-ui-beta.vercel.app"
  ]
  : ["http://localhost:5173"];
const normalizeOrigin = (o) => String(o || '').trim().toLowerCase().replace(/\/$/, '');
const envOriginsRaw = process.env.CORS_ORIGIN || '';
const envOrigins = envOriginsRaw.split(',').map(o => normalizeOrigin(o)).filter(Boolean);
const defaultAllowed = (defaultOrigins || []).map(o => normalizeOrigin(o)).filter(Boolean);
// Merge defaults with any provided via env
const allowedOrigins = Array.from(new Set([...defaultAllowed, ...envOrigins]));
console.log('CORS allowed origins:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const incoming = normalizeOrigin(origin);
    if (allowedOrigins.includes(incoming)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // Include common headers to satisfy preflight checks from browsers
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Manual preflight handler compatible with Express 5 routing
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    const incoming = normalizeOrigin(origin);
    if (!origin || allowedOrigins.includes(incoming)) {
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
      } else {
        res.header('Access-Control-Allow-Origin', '*');
      }
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      return res.sendStatus(204);
    }
  }
  next();
});

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const searchRoutes = require('./routes/searchRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/search', searchRoutes);
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
	return res.json({
		message: 'Brain-Box API is running',
		health: '/health',
		auth: ['/api/auth/signup', '/api/auth/login'],
		items: ['/api/items (GET, POST)', '/api/items/:id (GET, PUT, DELETE)'],
		search: ['/api/search (POST) - Semantic search with embeddings']
	});
});

app.get('/health', (req, res) => {
	res.json({ status: 'ok' });
});

app.use((req, res, next) => {
	res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
	console.error(err);
	res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5555;

connectDb()
	.then(() => {
		console.log('Connected to MongoDB');
		app.listen(PORT, () => {
			console.log(`Server listening on port ${PORT}`);
		});
	})
	.catch((error) => {
		console.error('Failed to connect to MongoDB', error);
		process.exit(1);
	});


