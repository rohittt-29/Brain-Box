const mongoose = require("mongoose");

const connectDb = async () => {
	const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/BrainBox";

	// In production (like Render), require an explicit DB URL to avoid attempting localhost
	if (process.env.NODE_ENV === 'production' && (!process.env.MONGO_URI && !process.env.DATABASE_URL && !process.env.MONGODB_URI)) {
		throw new Error("No MongoDB connection string provided in environment (MONGO_URI / DATABASE_URL / MONGODB_URI).");
	}

	await mongoose.connect(mongoUri);
};

module.exports = connectDb;