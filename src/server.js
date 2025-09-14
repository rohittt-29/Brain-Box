const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDb = require('./config/database');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);

app.get('/', (req, res) => {
	return res.json({
		message: 'Brain-Box API is running',
		health: '/health',
		auth: ['/api/auth/signup', '/api/auth/login'],
		items: ['/api/items (GET, POST)', '/api/items/:id (GET, PUT, DELETE)']
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


